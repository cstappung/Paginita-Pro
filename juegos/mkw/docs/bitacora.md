# Bitácora — qué se hizo y cómo

Registro detallado, en orden, de cada paso del port: qué se hizo, por qué, con qué comando y qué salió. Sirve
para entender el proyecto y para repetirlo desde cero. El plan (lo que falta) está en `PLAN.md`.

---

## Glosario — qué es cada cosa (para un ingeniero eléctrico)

Las palabras de software que aparecen en esta bitácora, en orden de "capas": del programa a la máquina, y de
ahí al navegador. Cuando ayuda, una comparación con electrónica. Se va ampliando con cada término nuevo.

### El programa y cómo se fabrica

| Término | Qué es y qué hace |
|---|---|
| **Código fuente** | El programa escrito por personas, en texto (`.cpp`, `.c`, `.js`). Es el "esquemático": describe el circuito, pero no es el circuito. |
| **C / C++** | Lenguajes de programación cercanos a la máquina (manejas memoria directamente). El runtime de WiiCompiled y el juego traducido están en C++. `.h` = **cabecera**: declaraciones compartidas entre archivos (como una hoja de datos con los pines de un integrado, sin el interior). |
| **Compilar / compilador** | Convertir el código fuente en instrucciones que entiende un procesador. Como pasar el esquemático a un layout de PCB fabricable. Compiladores usados: **clang** (el de Emscripten), **g++** (el de Strawberry/MinGW, para x86). |
| **Objeto (`.o`)** | El resultado de compilar UN archivo fuente: instrucciones ya traducidas pero con "cables sueltos" hacia funciones que viven en otros archivos. |
| **Enlazar (linker)** | Unir todos los `.o` en un solo programa conectando esos cables sueltos (cada llamada a una función con su dirección real). Si falta una función, el enlazador avisa ("símbolo sin resolver"), como un net sin conectar en el ERC. |
| **Ejecutable / binario** | El programa terminado, listo para correr (`.exe` en Windows, `.wasm` en la web). |
| **Librería** | Código ya hecho que otros programas reutilizan (SDL3, Dawn…). Como un módulo comercial que compras en vez de diseñar. |
| **Preprocesador, macro, `#if`** | Un paso antes de compilar que corta y pega texto. `#if defined(__EMSCRIPTEN__)` = "esta parte solo existe si compilo para la web". Es como un puente/jumper que elige qué parte del circuito se monta según la versión de la placa. |
| **Toolchain** | El juego completo de herramientas para fabricar el programa (compilador, enlazador, librerías del sistema). |
| **Script** | Un archivo con una lista de comandos que se ejecutan en orden (`.ps1` de PowerShell, `.sh` de Bash, `.py` de Python). Automatiza lo repetible. |
| **PowerShell / Bash** | Las dos "terminales" (líneas de comando) que usamos en Windows. Mismo trabajo, distinto idioma. |
| **CMake** | Herramienta que arma la "receta" de compilación de un proyecto grande (qué archivos, qué opciones, qué librerías y en qué orden). |
| **Ninja** | El que ejecuta esa receta muy rápido y en paralelo (16 compilaciones a la vez en este PC), y solo rehace lo que cambió. Nuestros scripts le escriben la receta directamente (`build.ninja`). |
| **Shard** | Un "pedazo" del juego traducido: el traductor agrupa las ~33 000 funciones en 202 archivos grandes para compilarlos en paralelo. |
| **Runtime** | El código que acompaña al juego traducido y hace de "Wii falsa": memoria, hilos, disco, gráficos, sonido, controles. |
| **HLE** (high-level emulation) | Imitar lo que hace una pieza de la Wii por su *función* y no por su circuito. Ej.: en vez de simular el chip del lector de DVD, cuando el juego pide "lee este archivo" se lee del disco duro. |
| **Stub** | Una función de relleno que no hace nada (o casi): permite que todo enlace y arranque mientras la pieza de verdad no existe. Como una resistencia de 0 Ω en lugar de un componente que aún no llega. |
| **`src/`, `include/`, `build/`** | Nombres de carpetas por convención. `src` (source) = el código fuente; `include` = las cabeceras `.h`; `build` = lo que sale de compilar (se puede borrar y rehacer). |
| **Log (registro)** | Las líneas de texto que un programa va escribiendo mientras corre ("cargué el archivo X", "empezó el cuadro 120"). Es el osciloscopio del programador: muestra qué pasó y en qué orden. |
| **Volcado (dump)** | Una copia completa de algo en un instante, guardada para revisarla después: un volcado de memoria (todos los bytes de la RAM del juego) o de un cuadro (la imagen de la pantalla). Como capturar la pantalla de un analizador lógico en un disparo. |
| **Depurar (debug)** | Buscar por qué un programa no hace lo que debe: leer el log, mirar volcados, detenerlo en un punto. |
| **Memoria (RAM)** | Donde un programa guarda los datos mientras corre: una fila enorme de casillas de 1 byte, cada una con su dirección (un número). Se pierde al apagar. |
| **MEM1 / MEM2** | Las dos memorias RAM de la Wii: MEM1 de 24 MB (rápida, dentro del chip gráfico) y MEM2 de 64 MB (externa). El runtime las imita con dos bloques de memoria del PC. |
| **Memoria lineal (de wasm)** | Toda la RAM que tiene un programa wasm: un solo bloque continuo de hasta 4 GB, como una memoria SRAM direccionable desde 0. Ahí viven el runtime, las MEM1/MEM2 de la Wii imitadas y todo lo demás. |
| **Puntero** | Una variable que guarda una dirección de memoria (dónde está algo), no el dato en sí. |
| **Heap / `malloc` / `free`** | El heap es la zona de memoria que el programa pide y devuelve mientras corre. `malloc` = "dame N bytes", `free` = "ya no los uso". |
| **API** | El conjunto de funciones que un módulo ofrece hacia afuera, con sus reglas de uso. El "pinout" de un software. |
| **ABI** | Las reglas eléctricas de esa conexión: en qué registros van los argumentos, cómo se devuelve el resultado. Dos piezas compiladas por separado solo funcionan juntas si respetan la misma ABI. |

### La Wii y la traducción

| Término | Qué es y qué hace |
|---|---|
| **PowerPC / Broadway** | El procesador de la Wii (arquitectura PowerPC, modelo Broadway). Habla otro "idioma de máquina" que el de un PC. |
| **x86 / ARM** | Las arquitecturas de los procesadores de PC (Intel/AMD = x86) y de celulares/Mac nuevos (ARM). |
| **Recompilación estática** | Traducir TODO el programa de la Wii (instrucciones PowerPC) a C++ una sola vez, antes de jugar, y compilarlo para otra máquina. Lo contrario de un emulador, que traduce sobre la marcha mientras juegas. WiiCompiled hace esto. |
| **Traductor** | El programa de WiiCompiled (en .NET, el entorno de programas de Microsoft) que lee `main.dol`/`StaticR.rel` y escribe el C++. |
| **DOL / REL / StaticR** | Los archivos de programa de la Wii. `main.dol` = el ejecutable principal; `StaticR.rel` = un módulo que se carga después (casi todo Mario Kart vive ahí). |
| **Disco RVZ / ISO / nodtool** | ISO = copia exacta del disco; RVZ = la misma copia comprimida (formato de Dolphin). `nodtool` saca los archivos de adentro. |
| **Invitado / anfitrión (guest / host)** | Invitado = la Wii imitada (el juego cree que está en una Wii). Anfitrión = la máquina real donde corre (el PC, el navegador). |
| **Registro (de CPU)** | Las poquísimas "celdas" de memoria ultrarrápida dentro del procesador donde se hacen las cuentas. Como los flip-flops de un registro de desplazamiento. |
| **Endianness / byteswap** | En qué orden se guardan los bytes de un número de varios bytes. La Wii pone primero el byte más significativo (big-endian, como mandar el MSB primero por un bus serie); el PC y wasm, el menos significativo. Cada lectura de memoria del juego invierte los bytes (byteswap). |
| **Memoria plana / tabla de páginas** | Memoria plana: las direcciones de la Wii caen directo en una zona del PC (rápido). Tabla de páginas: cada dirección se busca primero en una tabla que dice dónde está de verdad y qué es (más lento, pero funciona en wasm). Como decodificar direcciones con lógica vs. pasar por una EEPROM de mapeo. |
| **MMIO** | Registros de hardware de la Wii que el juego "ve" como direcciones de memoria (escribir ahí = mandarle algo a un chip). Igual que periféricos mapeados en el bus de direcciones de un microcontrolador. |
| **GX / EFB / VI** | GX = el chip gráfico de la Wii y sus funciones. EFB = su framebuffer interno (la imagen que se está dibujando). VI = el que manda la imagen a la tele 60 veces por segundo (el "barrido vertical"). |
| **Retro Rewind / Pulsar / Kamek / Code.pul** | Retro Rewind = el mod con pistas clásicas. Pulsar = el marco de mods en el que está hecho. Kamek = la herramienta que inyecta código en el juego. `Code.pul` = el código del mod (PowerPC), que WiiCompiled también traduce. |
| **Riivolution** | El sistema que, en una Wii, reemplaza archivos del disco por los del mod al vuelo. Aquí lo imita el runtime. |
| **WFC / Retro WFC** | Wi-Fi Connection: el servicio en línea de Nintendo (cerrado); Retro WFC es el reemplazo hecho por la comunidad. |

### Números con decimales (punto flotante)

| Término | Qué es y qué hace |
|---|---|
| **Punto flotante, float / double** | Cómo guarda una computadora un número con decimales: signo + mantisa + exponente (notación científica en binario). `float` = 32 bits (~7 cifras), `double` = 64 bits (~16 cifras). |
| **Redondeo** | Cada operación da un resultado exacto que casi nunca cabe en los bits disponibles: hay que redondearlo. Dos máquinas que redondean distinto dan resultados que difieren en el último bit, y en un juego de física eso se va acumulando. |
| **FMA (multiplicar y sumar fusionado)** | Calcular a·b + c con UN solo redondeo al final (en vez de redondear el producto y después la suma). Es el multiply-accumulate (MAC) de un DSP. La Wii lo usa todo el tiempo; wasm no tiene la instrucción, así que se arma por software con trucos exactos. |
| **Paired singles (ps_\*)** | Instrucciones de la Wii que operan dos float a la vez (un par), como un canal estéreo procesado en paralelo. |
| **SIMD / NEON / intrínsecos** | SIMD = una instrucción que opera varios números a la vez. NEON es el SIMD de ARM (SSE/AVX el de x86). Un "intrínseco" es escribir esa instrucción directo desde C++. Para wasm imitamos los de NEON con vectores genéricos. |
| **NaN, QNaN, SNaN** | "Not a Number": el resultado de algo sin sentido (0/0, ∞−∞). Es como la marca de "lectura fuera de rango" de un sensor. Hay silenciosos (QNaN) y "de señal" (SNaN). Distintos procesadores devuelven NaN con bits distintos; nosotros forzamos los de x86. |
| **Subnormal / flush-to-zero (FTZ) / NI** | Subnormales: números diminutos cerca de cero, que pierden precisión. FTZ: modo que los convierte en cero, como una banda muerta alrededor de 0. En la Wii ese modo es el bit NI del registro de control FPSCR. wasm no tiene ese modo. |
| **FPU / FPSCR / MXCSR / FPCR** | FPU = la parte del procesador que hace cuentas con decimales. FPSCR (Wii), MXCSR (x86) y FPCR (ARM) son sus registros de configuración (modo de redondeo, FTZ…). |
| **Paridad (prueba)** | Comprobar que dos versiones (x86 y wasm) dan exactamente los mismos bits para las mismas entradas. |
| **Hash / SHA-256 / FNV / huella** | Una "huella digital" de un archivo o de una lista de resultados: un número corto que cambia por completo si cambia un solo bit. Sirve para comparar millones de resultados de una vez o para verificar que un archivo es el correcto. |

### Hilos, pilas y esperas

| Término | Qué es y qué hace |
|---|---|
| **Hilo (thread)** | Una tarea del programa que avanza por su cuenta (el juego tiene varios: lógica, sonido, disco). |
| **Pila (stack)** | La memoria de trabajo de un hilo: cada vez que una función llama a otra, apila sus datos y los desapila al volver (LIFO, como una pila de platos). Cada hilo necesita la suya. |
| **Fiber** | Hilos que se turnan a mano en un solo procesador: uno corre, cede el turno, corre otro. Es multiplexación por división de tiempo, con conmutación explícita. |
| **Asíncrono, promesa, `await`** | En el navegador nada puede quedarse bloqueado esperando (se congela la página). Una "promesa" es un aviso de "te despierto cuando esto termine"; `await` es "suspéndeme hasta entonces". |
| **JSPI** | Función nueva de Chrome que deja que el wasm se suspenda en medio de una función y siga después, sin congelar la página. Gracias a eso hicimos los fibers del juego. |
| **Asyncify** | La alternativa vieja a JSPI: reescribe todo el programa para poder pausarlo. Funciona, pero el resultado es mucho más grande y lento. |
| **Excepción, `try` / `catch`** | Una forma de avisar un error que salta hacia atrás por las funciones hasta que alguna lo "atrapa" (`catch`). Como una interrupción que se propaga hasta el manejador correspondiente. |

### El navegador y la web

| Término | Qué es y qué hace |
|---|---|
| **WebAssembly (wasm)** | El "idioma de máquina" de los navegadores: un formato binario compacto que Chrome traduce al procesador real de cada equipo. El `.wasm` es el juego compilado para la web. |
| **JavaScript (JS)** | El lenguaje de programación de las páginas web. Arranca el wasm y le da acceso a pantalla, sonido, controles. |
| **V8 / Liftoff / TurboFan** | V8 = el motor de Chrome que corre JS y wasm. Liftoff traduce el wasm rápido y sin optimizar (para arrancar ya); TurboFan lo re-traduce optimizado para las funciones que más se usan. |
| **Node (Node.js)** | El motor V8 de Chrome sacado del navegador para correr programas en la terminal, sin ventana. Lo usamos para probar el juego sin pantalla y depurarlo fácil. |
| **Emscripten / em++ / emcc / emsdk** | El toolchain que compila C/C++ a wasm. `em++` (C++) y `emcc` (C) son sus compiladores; `emsdk` es el instalador. |
| **Port (de Emscripten)** | Una librería ya adaptada a la web que Emscripten baja y compila sola (`--use-port=sdl3`, `--use-port=emdawnwebgpu`). |
| **WebGPU / WebGL** | Las formas de usar la tarjeta de video desde una página. WebGPU es la moderna (la que usamos); WebGL la anterior. |
| **Dawn / emdawnwebgpu / aurora** | Dawn = la implementación de WebGPU de Google. emdawnwebgpu = su versión para wasm. aurora = la librería de WiiCompiled que traduce los gráficos de la Wii (GX) a WebGPU. |
| **Shader / WGSL** | Pequeños programas que corren en la tarjeta de video (calculan la posición y el color de cada píxel). WGSL es el lenguaje de los shaders de WebGPU. |
| **SDL3** | Librería que da acceso a sonido, controles y ventana de forma igual en todos los sistemas. Emscripten tiene un port que traduce eso a las funciones del navegador (WebAudio, Gamepad API). |
| **requestAnimationFrame (rAF)** | El navegador avisa "dibuja ahora" una vez por refresco de pantalla (60 o 240 veces por segundo, según el monitor). Es el "sincronismo vertical" de la página. |
| **Gamepad API / DeviceOrientation** | Funciones del navegador para leer mandos y la inclinación del celular (giroscopio). |
| **localStorage / IndexedDB / OPFS** | Lugares donde una página guarda datos en el equipo del usuario (de menor a mayor capacidad). Aquí irán las partidas guardadas. |
| **COOP / COEP** | Dos encabezados que manda el servidor para "aislar" la página; son requisito para algunas funciones avanzadas del navegador. |
| **Worker (Cloudflare) / R2 / Firebase** | Worker = un programita que corre en los servidores de Cloudflare y decide quién puede bajar qué (solo amigos). R2 = el almacén de archivos de Cloudflare (donde vivirá el `.wasm`). Firebase = la base de datos en vivo de Google (salas, chat). |
| **UDP / TCP / WebSocket / WebRTC / relé** | Formas de mandar datos por internet. El juego en línea usa UDP/TCP directos, que el navegador no permite; WebSocket y WebRTC sí. Un relé es un servidor intermedio que traduce entre ambos. |
| **gzip / brotli** | Compresión de archivos para bajarlos más rápido; el navegador los descomprime solo. |
| **`#embed` / `.incbin`** | Formas de meter un archivo binario completo (p. ej. datos del juego) adentro del ejecutable al compilar. `.incbin` es de ensamblador (no existe para wasm); `#embed` hace lo mismo desde C++. |

### Correr el juego sin pantalla (fase 2)

| Término | Qué es y qué hace |
|---|---|
| **Headless (sin pantalla)** | Correr un programa que normalmente dibuja en una ventana, pero sin ventana ni tarjeta de video: solo se ve su log. Como probar una fuente de poder con carga resistiva en vez del equipo real. |
| **Símbolo** | El nombre de una función o variable tal como lo ve el enlazador. "Símbolo sin resolver" = alguien llama a una función que nadie fabricó. |
| **Generador de código** | Un script que escribe código por nosotros a partir de otra información (aquí: las 146 funciones vacías de aurora a partir de sus cabeceras). |
| **Config.toml / TOML** | El archivo de configuración del runtime (dónde está el disco, volumen, red…). TOML es un formato de texto simple: secciones `[paths]` y líneas `clave = valor`. |
| **Ruta relativa / absoluta / canónica** | Absoluta: la dirección completa de un archivo (`C:/…/disco`). Relativa: cómo llegar desde una carpeta dada (`../../extraido/disco`, donde `..` = "subir una carpeta"). Canónica: la absoluta "limpia" que da el sistema operativo (`realpath`). |
| **NODERAWFS** | Opción de Emscripten para que el wasm, corriendo en Node, lea y escriba los archivos del PC directamente. |
| **FST** | La tabla de contenidos del disco de la Wii: qué archivos hay y dónde. El runtime arma una nueva con los archivos del disco más los reemplazos de Retro Rewind. |
| **NAND** | La memoria interna de la Wii (partidas guardadas, Miis, ajustes). Aquí es una carpeta del PC (`build/web/datos/WiiCompiled/NAND`). |
| **Constructores estáticos** | Código que un programa corre automáticamente antes de empezar (prepara sus objetos globales). Mario Kart tiene 235 entre el DOL y StaticR. |
| **Arena de memoria** | La zona de RAM que el sistema de la Wii le entrega al juego para que la reparta. |
| **Escena** | Cada "pantalla" del juego (aviso de inicio, título, menús, carrera). Cambiar de escena carga sus archivos. |
| **Payload** | Un pedazo de código que se inyecta y corre dentro del juego (aquí el de Retro WFC, para el juego en línea). |
| **Driver** | El programa que controla un dispositivo (sonido, video). El driver "dummy" de SDL hace como que hay tarjeta de sonido y descarta todo. |
| **Espera activa (busy-wait)** | Esperar mirando el reloj en un ciclo sin fin: el procesador trabaja al 100 % sin hacer nada útil. Lo contrario: una espera que "suelta" el procesador y lo despiertan después (como pasar de un lazo de sondeo a una interrupción). |
| **Ritmo (pacing) / barrido** | El juego se frena a sí mismo para dar exactamente 60 cuadros por segundo, al ritmo del barrido vertical de la tele (cada 16,67 ms). |
| **Trabajo por cuadro** | Cuántos milisegundos de cada cuadro de 16,67 ms el procesador estuvo realmente calculando el juego; el resto esperó al siguiente barrido. Es el "ciclo de trabajo" (duty cycle) del juego. |
| **Reloj virtual / determinista** | Un reloj de mentira que avanza solo cuando el programa lo dice (no con el tiempo real). Con él, la misma entrada da siempre el mismo resultado (determinista), y se puede correr más rápido que el tiempo real. |
| **`setjmp` / `longjmp`** | Un mecanismo antiguo de C para "saltar hacia atrás" a un punto marcado, saltándose funciones. El runtime lo usa al correr los constructores; en wasm hay que activarlo (`-sSUPPORT_LONGJMP=wasm`). |
| **`OSReport`** | La función con la que los programadores de Nintendo dejaban mensajes en el log del juego. Los vemos con `[OSReport]`: el juego "cuenta" lo que hace. |

### El juego en el navegador (fase 3)

| Término | Qué es y qué hace |
|---|---|
| **Canvas (`<canvas>`)** | Un rectángulo de la página donde un programa puede dibujar píxeles. Es la "pantalla de la tele" del juego dentro de la página. |
| **Superficie (surface) / presentar** | La superficie es la conexión entre WebGPU y el canvas. Presentar = mostrar la imagen terminada. En el PC aurora llama a `Present()`; en el navegador esa función no existe: la página muestra la imagen sola cuando el programa le devuelve el control. |
| **Hilo (thread)** | Un "trabajador" del programa que corre a la par de los demás, como dos operarios en dos máquinas. aurora usa varios en el PC (uno arma los cuadros, otro los presenta, otros compilan shaders). La versión web del juego tiene **un solo hilo**: todo lo hace el mismo trabajador, por turnos. |
| **Variable de condición (condition variable)** | La forma en que un hilo "duerme" hasta que otro le avisa. Con un solo hilo nadie puede avisar: esperar así sería quedarse dormido para siempre (o girar sin fin). |
| **MapAsync** | Pedirle a la GPU "devuélveme este búfer (bloque de memoria de video) para leerlo o llenarlo". La respuesta llega después; en el navegador, solo cuando la página "respira" (cuando el programa le devuelve el control). |
| **Búfer de preparación (staging buffer)** | Un búfer intermedio donde el programa deja los datos del cuadro (vértices, uniformes, índices) antes de pasarlos a los búferes que usa la GPU para dibujar. Como el capacitor de entrada de una fuente: junta la carga y después se descarga de una vez. aurora usa uno de 37 MB por cuadro. |
| **Mapear / desmapear (`GetMappedRange` / `Unmap`)** | Mapear = que el programa pueda escribir directo en un búfer de la GPU como si fuera su propia memoria; desmapear = devolvérselo a la GPU. En el PC es casi gratis (la misma memoria). En el navegador no: el wasm y la GPU viven en procesos distintos, así que Emscripten reserva una copia en la memoria del wasm, la llena de ceros y al desmapear copia **todo** el rango, se haya usado o no. |
| **`WriteBuffer` (`Queue::WriteBuffer`)** | La otra forma de llenar un búfer de la GPU: "copia estos N bytes a este búfer". Copia solo lo que se le pasa, en el orden de la cola de la GPU (después de lo ya enviado, antes de lo que se envíe luego). |
| **Pegamento (glue) de Emscripten** | El JavaScript que Emscripten genera junto al `.wasm` (`mkw.js`) para todo lo que el wasm no puede hacer solo: hablar con WebGPU, leer el reloj, pedir archivos. Cada vez que el wasm lo llama hay un pequeño costo de "cruzar la frontera". |
| **Traza del ritmo** | Una lista, con hora, de los momentos de cada cuadro: el juego entrega el cuadro (1), aurora vuelve (2), el juego se pone a esperar ('e') y se despierta ('w'). Con `?traza=1` la página la guarda; `guion.mjs --traza` la vuelca y `herramientas/tiempos-cuadro.mjs` la convierte en "cuánto trabajó cada parte en cada cuadro". Como un osciloscopio con varias puntas sobre el mismo ciclo. |
| **Origen** | La "dirección de la casa" de una página: protocolo + nombre + puerto (`https://paginita-pro.cl`). Dos páginas del mismo origen se tratan como de confianza entre sí; de orígenes distintos, el navegador las separa y pide permisos (CORS). El sitio está en GitHub Pages y lo privado en el Worker: dos orígenes. |
| **iframe (marco)** | Una página metida dentro de otra, como una ventana. La sección Juegos abre cada juego en un iframe a pantalla completa (`crearBt3Solo`); el juego corre en su propia página, con su propio hilo de JavaScript compartido con la página de afuera. |
| **crossOriginIsolated / SharedArrayBuffer** | `SharedArrayBuffer` es memoria que varios hilos ven a la vez (lo que necesitan los hilos de WebAssembly). El navegador solo la da si la página está "aislada" (`crossOriginIsolated` = true), y para eso el servidor debe mandar COOP/COEP. GitHub Pages no las manda: la página del sitio NO está aislada. El juego no la necesita (un solo hilo + JSPI). |
| **Caché HTTP** | Donde el navegador guarda lo que bajó, según lo que diga la cabecera `Cache-Control` del servidor: `no-store` = no guardar; `max-age=600` = sirve 10 minutos; `immutable` = no cambia nunca (para eso la dirección lleva una huella, `?v=…`, que cambia con cada versión). Como un banco de capacitores de reserva: si ya está cargado, no se pide de nuevo a la fuente. |
| **Caché de código** | Chrome, además del archivo, guarda el **código de máquina ya compilado** del `.wasm` (si la respuesta era guardable). En la próxima visita no compila de nuevo. |
| **instantiateStreaming** | La forma de cargar un `.wasm` que compila MIENTRAS se baja (no espera el archivo entero). Necesita la respuesta del servidor tal cual (no un "blob" armado por la página) y el tipo `application/wasm`. Emscripten la usa sola. |
| **Content-Encoding (br / gzip)** | La cabecera con que el servidor dice "esto viaja comprimido": el navegador lo descomprime solo, por el camino. Brotli (`br`) comprime más que gzip. El `.wasm` se guarda ya comprimido (`mkw.wasm.br`, 16 MB en vez de 124). |
| **Percentil (p95, p99)** | Ordenando todas las medidas de menor a mayor, el p95 es la que deja el 95 % por debajo. El promedio esconde los picos; el p99 dice "1 de cada 100 cuadros tarda esto o más". Como la tensión de rizado pico, no la media. |
| **Frenar la CPU (throttling)** | Chrome puede hacer que el procesador ande N veces más lento (`Emulation.setCPUThrottlingRate`) para ver cómo se portaría en un PC o teléfono más débil. Perfiles: `cpu4` (4 veces) y `celular` (6 veces + pantalla de Pixel 7). |
| **Actualización de la pantalla** | Una vez por refresco del monitor, el navegador corre los `requestAnimationFrame`, dibuja la página y le entrega la imagen al **compositor**. En ese momento "toma" el canvas del juego. Solo puede hacerlo cuando el hilo está libre: si el juego tiene el hilo, la actualización se **atrasa**. |
| **Compás de la toma** | La regla de §54 para que cada cuadro del juego se vea el mismo tiempo: a 240 Hz, la textura del canvas se toma recién después de la actualización del refresco "toma anterior + 3", así la del + 4 se la lleva. Como un tren de pulsos sincronizado con un reloj, en vez de disparado por cada evento. |
| **Cola de prioridad baja** | La fila de bajadas "por si acaso" (la semilla de bloques, las voces de los CPU): avanza solo cuando el juego no está esperando nada, un pedido cada 15 ms como mucho, para no quitarle red a lo urgente. |
| **Bucle de eventos (event loop)** | El ciclo del navegador: atiende un aviso (un clic, un temporizador, la respuesta de la red, la GPU), luego otro… Si un programa no le devuelve el control, el ciclo se para y la página se congela. |
| **Ceder el control (yield)** | Que el programa diga "sigo después" y deje correr al bucle de eventos. Con JSPI el juego se pausa en medio de una función y continúa donde estaba cuando llega lo que esperaba. |
| **MEMFS** | El sistema de archivos de mentira de Emscripten, guardado en la memoria (RAM) de la página: carpetas y archivos que el juego abre como si fueran del disco. Se borra al cerrar la página. |
| **Archivo perezoso** | Un archivo que en MEMFS existe con su nombre y tamaño, pero sin contenido: el contenido se baja recién cuando el juego lo lee, y solo el pedazo leído. Como un catálogo con todos los libros listados, pero que trae cada página recién cuando la pides. |
| **Manifiesto** | La lista de todos los archivos (ruta y tamaño) que el juego verá en su disco. La arma el servidor local y la usa la página para crear el MEMFS. |
| **HTTP / petición / servidor local / 127.0.0.1** | HTTP = el idioma con que el navegador pide archivos a un servidor. Un servidor local corre en la misma PC; `127.0.0.1` es la dirección "yo mismo": ninguna otra máquina puede entrar. |
| **HTTP Range** | Pedir solo un pedazo de un archivo (`Range: bytes=1000-1999`), como leer una sola página de un libro sin traer el libro. El servidor responde `206` (contenido parcial). |
| **Huella SHA-256** | Un número de 64 dígitos que se calcula de un archivo; si cambia un solo byte, la huella cambia por completo. Sirve para comprobar que lo bajado es exactamente lo esperado (como el número de serie de un componente). |
| **abseil / fmt / imgui / sqlite / tracy** | Librerías que usa aurora. abseil: tablas rápidas para buscar datos. fmt: arma textos para el log. imgui: menús dibujados encima del juego. sqlite: base de datos en un archivo (caché de shaders; en la web va apagada). tracy: medidor de tiempos para depurar (apagado). |
| **Pipeline / caché de pipelines** | Pipeline = la "receta" completa que la GPU necesita para dibujar algo (qué shaders, qué mezclas de color). Armarla cuesta; la caché las guarda para la próxima vez. |
| **Enlace duro (hard link)** | Dos nombres para el mismo archivo en el disco. El runtime lo usaba para guardar archivos de la NAND sin pisar nada; el sistema de archivos de Emscripten no lo tiene, así que en la web se renombra. |
| **Perfil (profiler)** | Una medición de en qué funciones pasa el tiempo un programa: el navegador mira miles de veces por segundo "¿qué función corre ahora?" y cuenta. Como un analizador que muestra qué etapa del circuito consume más. |
| **CDP (Chrome DevTools Protocol)** | La "puerta de servicio" de Chrome: por ahí Playwright puede pausar la página, perfilarla o sacarle capturas. |
| **Refresco del monitor (Hz) / vsync** | Cuántas veces por segundo el monitor dibuja una imagen nueva (60, 144, 180 Hz…). El vsync es el instante de cada refresco. Si el juego (60 fps) entrega sus cuadros parejos, en 180 Hz cada cuadro dura exactamente 3 refrescos. |
| **Tirón (judder / stutter)** | Cuando un cuadro dura en pantalla más o menos que los otros (4 refrescos en vez de 3): el movimiento se ve a saltos aunque el promedio sea 60 fps. |
| **`setTimeout`** | "Despiértame en N milisegundos" del navegador. No es exacto: puede llegar 1–4 ms tarde (y Chrome lo redondea a 4 ms cuando se encadenan muchos). |
| **Fase (de un reloj)** | En qué punto de su ciclo está un reloj respecto de otro. "Correr la fase" del reloj del juego = moverlo un poco para que sus cuadros caigan justo después de cada refresco del monitor (como enganchar un PLL a una referencia). |
| **PLL (lazo de enganche de fase)** | Un circuito que mantiene un oscilador en fase con una referencia: mide la diferencia de fase, la filtra y corrige el oscilador de a poco. Aquí el "oscilador" es el reloj VI del juego y la referencia es el refresco del monitor (§33). |
| **Error de fase / ganancia** | Error de fase: cuánto adelanta o atrasa el barrido del juego respecto del refresco (en ms). Ganancia: qué parte de ese error se corrige en cada cuadro (aquí 1/4, con un tope de 0,25 ms). |
| **Mediana / percentil** | Mediana: el valor del medio de una lista ordenada (no le afectan unos pocos valores raros). Percentil 20: el valor que deja abajo al 20 % de la lista. |
| **GPU integrada / dedicada** | Integrada: la gráfica que viene dentro del procesador (aquí, la AMD del Ryzen): consume poco. Dedicada: la tarjeta aparte (aquí, la RTX 3080 Ti): mucho más potente. |
| **Adaptador (WebGPU) / powerPreference** | Adaptador: la tarjeta de video que el navegador le entrega a la página. `powerPreference` es el único pedido posible ("alto rendimiento" o "bajo consumo"); el navegador puede ignorarlo. |
| **Puerto (de mando)** | Cada una de las 4 entradas de mando de la GameCube/Wii (jugador 1 a 4). El juego lee "lo que hay en el puerto N"; no sabe si detrás hay un teclado, un mando de Xbox o un celular. |
| **Bits de botones / máscara** | El estado de los 12 botones del mando cabe en un solo número: cada botón es un bit (A = 0x100, B = 0x200, R = 0x20…), 1 = apretado. Como un puerto de entradas digitales de un PLC donde cada borne es un bit de una palabra. |
| **Gancho (hook)** | Un punto donde nuestro código se "cuelga" de otro para meter o sacar datos. Aquí la página llama a `mkw_web_pad(...)` y el juego, al leer sus mandos (`PADRead`), recibe eso. |
| **Evento de teclado / `code` / `preventDefault`** | Cada tecla que se aprieta o suelta genera un aviso (`keydown`/`keyup`) con su posición física (`code`, p. ej. `KeyK`: la misma tecla aunque el teclado sea francés). `preventDefault` le dice al navegador "esta tecla es mía, no hagas lo de siempre" (que la flecha no mueva la página); solo se usa con las teclas del juego. |
| **Mapeo "standard" (Gamepad API)** | Una numeración común de botones que Chrome aplica a los mandos conocidos (Xbox, PlayStation, Switch Pro…): el botón 0 siempre es el de abajo, el 7 el gatillo derecho, etc. Así un solo mapeo sirve para todas las marcas. |
| **Zona muerta (deadzone)** | Un margen alrededor del centro del stick donde se lee "suelto": los sticks nunca vuelven exactamente a 0 y sin esto el kart giraría solo. Es la banda muerta de un controlador. |
| **Gatillo analógico** | Un gatillo (L/R) que dice cuánto se apretó (0 a 255), no solo sí/no. El de la GameCube además tiene un clic digital al fondo. |
| **Pointer events / multitáctil / captura** | Avisos del navegador para cada dedo (o mouse) que toca, se mueve o se levanta, cada uno con su número (`pointerId`): así se siguen varios dedos a la vez. "Capturar" un dedo = seguir recibiendo sus avisos aunque se salga del botón. |
| **`deviceorientation` (beta, gamma)** | El aviso del navegador con la inclinación del teléfono, en grados, medida por sus sensores (giroscopio/acelerómetro). El giro "de volante" se lee en el ángulo beta. |
| **Vibración (rumble)** | El motorcito con peso descentrado del mando. El juego lo prende y apaga (`PADControlMotor`); la página lo pasa al mando (`vibrationActuator`) o al celular (`navigator.vibrate`). |
| **Línea base (medición)** | Medir primero sin estímulo para saber cuánto cambia "solo"; después, con estímulo. La diferencia es el efecto real (como medir el ruido de fondo antes de la señal). |
| **AudioContext** | La "tarjeta de sonido" de una página: arma un circuito de nodos de audio (fuentes, volúmenes, medidores) que termina en los parlantes (`destination`). Arranca "suspendido" hasta que la persona toca la página. |
| **ScriptProcessorNode / AudioWorklet** | Dos formas de que un programa entregue muestras de sonido. El ScriptProcessorNode (el que usa SDL3) pide un bloque cada tanto en el mismo hilo que el juego; el AudioWorklet, más nuevo, corre en el hilo de audio y permite bloques más chicos (menos demora). |
| **Muestra / frecuencia de muestreo** | El sonido digital son valores de la onda tomados a intervalos fijos (muestras). 48 000 Hz = 48 000 valores por segundo por canal. Es el muestreo de un osciloscopio digital. |
| **Remuestreo (resampling)** | Convertir sonido de una frecuencia de muestreo a otra (32 000 → 48 000 Hz) calculando valores intermedios. Cambiar un poco la relación (ratio) hace que se consuma más rápido o más lento. |
| **dB / dBFS / valor eficaz (RMS)** | El nivel del sonido en decibeles respecto del máximo posible (0 dB = el máximo; −20 dB = una décima de la amplitud). RMS es el valor eficaz de la onda, el mismo de la tensión alterna. |
| **Política de autorreproducción (autoplay)** | La regla de los navegadores: una página no puede sonar hasta que la persona la toque, haga clic o apriete una tecla ("gesto"). |
| **Cola de audio (FIFO)** | Un búfer donde el juego deja sonido y la tarjeta lo saca en el mismo orden (primero en entrar, primero en salir). Si se vacía, hay un corte; si se llena, se tira un bloque. |
| **Deriva de reloj (clock drift)** | Dos relojes "de la misma frecuencia" nunca son idénticos: uno adelanta un poquito al otro y la diferencia se acumula. Aquí: el reloj del juego (enganchado al monitor) contra el cristal de la tarjeta de sonido. |
| **Controlador PI** | Un control con parte Proporcional (corrige según el error de ahora) e Integral (acumula el error para eliminar la diferencia fija). Es el filtro de lazo típico de un PLL o de un lazo de control de un convertidor. |
| **Latencia (de audio)** | La demora entre que el juego produce un sonido y se oye. Medida con un clic (§88): ~177 ms con el ScriptProcessorNode de SDL3 (su bloque más la cola del runtime y la del navegador), ~60 ms con el AudioWorklet. |
| **Comparación A/B** | Correr lo mismo dos veces cambiando una sola cosa (con y sin el módulo de sonido) para ver si esa cosa es la causa. |
| **Traza de Chrome (tracing)** | El registro interno de Chrome: anota con hora exacta lo que hace cada parte (la página, el compositor, la tarjeta). Se graba por CDP. El evento `Display::FrameDisplayed` dice en qué refresco se mostró cada imagen: es la medida de lo que de verdad se ve (como poner la punta del osciloscopio en la salida y no en una señal interna). |
| **Compositor (de Chrome) / DWM (de Windows)** | El compositor junta todo lo que se ve de la página (el canvas, los textos) en una sola imagen y se la pasa a Windows; el DWM (Desktop Window Manager) junta las ventanas de todos los programas y la manda al monitor en cada refresco. Cada uno agrega su demora. |
| **Toma del canvas (actualización de la pantalla)** | El momento en que el navegador, con el control devuelto, corre los rAF y se lleva la imagen nueva del canvas al compositor. En este juego solo pasa en la pausa de aurora (§43). |
| **Girar (espera activa, busy-wait)** | Esperar preguntando la hora una y otra vez en un lazo, sin ceder el control. Es exacto, pero ocupa un núcleo entero y el navegador no puede hacer nada mientras tanto. |
| **Hora vieja (de rAF)** | Si el hilo estuvo ocupado, el rAF corre tarde pero con la hora del refresco que se perdió: dice "cuándo debió correr", no "cuándo corrió". |
| **Banda muerta (en un lazo de control)** | Un margen dentro del cual el control no corrige: aquí la fase del reloj VI solo se mueve si la medida cambió más de 0,3 ms, para no perseguir el ruido (como la histéresis de un comparador). |
| **Medida indirecta (proxy)** | Medir algo que "debería" seguir a lo que interesa, porque lo que interesa no se puede medir directo. El contador de cuadros era una medida indirecta de la pantalla… y resultó que no la seguía (§43). |
| **Tarea / microtarea (del navegador)** | El bucle de eventos atiende "tareas" de a una (un temporizador, un mensaje, un rAF). Una "microtarea" (lo que sigue después de cumplirse una promesa) corre apenas termina la función actual, dentro de la MISMA tarea. Para que algo corra después de que el navegador termine lo que está haciendo hay que mandarlo a una tarea nueva. |
| **MessageChannel** | Un "tubo" de mensajes de la página consigo misma: lo que se manda por un extremo llega al otro como una tarea nueva, casi sin demora. Aquí se usa para despertar al juego después de la actualización de la pantalla. |
| **Alargue de temporizadores encadenados (clamping)** | Regla de los navegadores: si un `setTimeout` se pide desde otro, y eso pasa más de 5 veces seguidas, cada uno espera al menos 4 ms aunque se pida 1 ms. Evita que una página sature la CPU con temporizadores. |
| **Ocupación del hilo (TaskDuration)** | Qué parte del tiempo el hilo principal de la página estuvo trabajando (o girando). 80 % = casi un núcleo entero; 37 % = el resto del tiempo duerme. Como el ciclo de trabajo (duty cycle) de una señal PWM. |
| **IndexedDB** | Una base de datos que cada página tiene en el disco del usuario (no en internet). Aguanta varios MB y sobrevive a cerrar el navegador. Ahí van las partidas. |
| **Enganche (hook) a una función** | Reemplazar una función por otra que hace lo mismo y además avisa ("el juego cerró un archivo escrito"). Como poner una pinza amperimétrica en un cable sin cortarlo. |
| **Rebote (debounce)** | Esperar a que algo deje de cambiar antes de actuar: aquí, medio segundo sin escrituras antes de guardar. Es el antirrebote de un pulsador. |
| **Transacción** | Un grupo de cambios en la base de datos que se aplica entero o nada (si falla a la mitad, no queda a medias). |
| **gzip / compresión** | Achicar un archivo aprovechando lo que se repite. La partida (2,8 MB, casi toda ceros) queda en pocos KB. |
| **Paquete de partidas (.mkwp)** | Un solo archivo con todas las partidas (índice + datos, comprimido): para pasarlas a otro navegador y, en el sitio, para subirlas a la nube. |
| **Firebase Storage / reglas** | El almacén de archivos de Firebase. Las "reglas" deciden quién lee o escribe cada archivo; en el sitio cada objeto lleva el uid de quien lo subió y solo esa persona lo reemplaza. |
| **uid** | El número de identidad que Firebase le da a cada persona que inicia sesión. |
| **Almacenamiento persistente** | Un pedido al navegador para que no borre los datos de la página cuando le falte espacio. Chrome lo concede solo a sitios que la persona usa seguido. |
| **Guion (de prueba)** | Un programa que maneja el juego apretando teclas con pausas y saca fotos: llega solo a una pantalla concreta. |
| **Cache Storage** | Un almacén del navegador para guardar respuestas de internet (archivos) en el disco del usuario, por página, que sobrevive a cerrarla. BT3 guarda ahí su disco; aquí, los pedazos bajados del disco de MKW. |
| **Bloque (de caché)** | Un pedazo de tamaño fijo (256 KB) en que se parte cada archivo para guardarlo. Como leer una memoria flash por páginas: aunque pidas 10 bytes, se trae la página entera, y la próxima lectura cercana ya está. |
| **LRU (lo menos usado recientemente)** | La regla para decidir qué sacar de la memoria cuando se llena: lo que hace más tiempo que nadie usa. |
| **Versión (de la caché)** | Un número corto que cambia si cambia cualquier archivo del disco o de Retro Rewind (huella de rutas, tamaños y fechas). Si no coincide con la caché guardada, la vieja se tira: nunca se mezclan pedazos de dos versiones. |
| **Viewport y profundidad (depth)** | El viewport es el rectángulo de la pantalla donde se dibuja; la profundidad dice qué tan lejos está cada punto (para tapar lo de atrás con lo de adelante). WebGPU exige que la profundidad vaya de 0 a 1, como una entrada de ADC que no acepta más que su rango. |
| **Limitar (clamp)** | Recortar un valor a un rango: si se pasa, se queda en el tope. Un diodo recortador. |
| **CPU-bound (limitado por la CPU)** | Cuando lo que frena es el cálculo del procesador, no la tarjeta de video ni la red. El eslabón más lento de la cadena. |
| **Promesa (Promise)** | En JavaScript, un "vale" por un resultado que llegará después (una lectura de la red, por ejemplo). Si llega un error y nadie lo atiende, el navegador lo avisa como "error sin atender". |
| **Sincronizar** | Dejar dos copias (la del navegador y la de la nube) iguales, copiando en el sentido que corresponda. |
| **Conflicto (de sincronización)** | Cuando las dos copias cambiaron por su lado desde la última vez que estaban iguales (se jugó en dos aparatos sin conexión). No hay una "correcta": se elige una (la jugada más recientemente) y la otra se guarda de respaldo. |
| **Metadatos personalizados (customMetadata)** | Datos chicos pegados a un archivo de Firebase Storage (como la etiqueta de un cable): quién lo subió, su huella, cuándo se jugó. Se leen sin bajar el archivo. |
| **Adaptador (de almacén)** | Una pieza chica que traduce entre nuestro código y un servicio concreto (aquí: tres funciones, meta/bajar/subir, hacia Firebase). Cambiando el adaptador se prueba con una nube falsa, como un conector intercambiable. |
| **SDK de Firebase** | La librería de Google para hablar con Firebase desde la página (iniciar sesión, subir y bajar archivos). El sitio la carga desde el CDN de Google, versión 10.12.2. |
| **Código de amigo (friend code) / pid** | El pid es el número de cada jugador en el servidor en línea (32 bits). El código de amigo son 12 cifras: el pid con 7 bits de control delante, calculados con MD5. Como el dígito verificador del RUT: delata un código mal escrito. |
| **MD5** | Una huella de 128 bits, más vieja y débil que SHA-256 (no sirve para seguridad), pero es la que usa la Wii para el control del código de amigo. |
| **VR (versus rating)** | El puntaje en línea de cada jugador: sube al ganar carreras y baja al perder. |
| **CORS** | La regla del navegador que decide si una página de un sitio puede leer datos de otro sitio. El servidor lo permite con la cabecera `Access-Control-Allow-Origin`; Retro WFC responde `*` (cualquiera). |
| **Sondeo (polling) y espera creciente** | Preguntar cada tanto si hay datos nuevos (cada 15 s). Si el servidor falla, se espera el doble cada vez antes de volver a preguntar, para no insistirle a un servidor caído. |
| **THP** | El formato de video de Nintendo: cuadros JPEG que la CPU de la Wii descomprime. Mario Kart lo usa para la vista previa de cada pista al elegirla. |
| **`-O2` / `-O3` / `-msimd128`** | Opciones del compilador: `-O2`/`-O3` = cuánto se esfuerza en optimizar; `-msimd128` = permitir instrucciones SIMD de wasm (operar 4 números a la vez). |
| **Emulación de dispositivo** | Chrome haciéndose pasar por un celular (tamaño de pantalla, táctil, "puntero grueso") para probar la página sin el teléfono. |
| **cqmin** | Una unidad de medida de CSS: 1 % del lado más corto de un recuadro. Con ella los botones miden lo mismo con el teléfono parado o acostado. |
| **JPEG (de línea base)** | El formato de foto más común: parte la imagen en bloques de 8×8 píxeles, guarda de cada bloque su "receta en frecuencia" (DCT), tira los detalles finos que el ojo no ve (cuantización) y comprime lo que queda (Huffman). "Línea base" = la variante simple, de una sola pasada. Cada cuadro de un video THP es un JPEG. |
| **DCT / IDCT** | La transformada discreta del coseno: escribe un bloque de 8×8 píxeles como suma de 64 patrones coseno (de "liso" a "rayado fino"), igual que Fourier escribe una señal como suma de senoidales. La IDCT es la inversa: de los 64 coeficientes vuelve a los píxeles. Es la parte de más cuentas al decodificar. |
| **AAN (IDCT rápida)** | Una forma de calcular la IDCT de 8 puntos (Arai, Agui y Nakajima, 1988) con 5 multiplicaciones en vez de 64, como una FFT frente a la DFT directa. Las multiplicaciones que se ahorra se meten de antemano en la tabla de cuantización. |
| **Cuantización (JPEG)** | Dividir cada coeficiente por un "escalón" y redondear: las frecuencias altas usan escalones grandes (se guardan con poca precisión). Al decodificar se multiplica de vuelta. Es como un conversor A/D con distinta resolución por banda. |
| **Huffman** | Un código de largo variable: los valores frecuentes llevan códigos cortos, los raros largos (como el Morse: la E es un punto). Decodificar = leer bit a bit hasta reconocer un código. Se acelera con una tabla que reconoce de un vistazo todos los códigos de hasta 9 bits. |
| **Relleno 0xFF00 (byte stuffing)** | En un JPEG normal, un byte 0xFF dentro de los datos se escribe 0xFF 0x00 para no confundirlo con un marcador. Los THP NO lo hacen: el decodificador sabe cuándo termina porque cuenta los bloques. |
| **YUV / 4:2:0** | Guardar el color como brillo (Y) y dos diferencias de color (U, V) en vez de rojo-verde-azul. El ojo nota menos el color que el brillo, así que U y V van a la mitad de ancho y de alto (4:2:0): un cuarto de datos cada uno. |
| **MCU** | La "unidad mínima" de un JPEG 4:2:0: un cuadrado de 16×16 píxeles = 4 bloques de Y + 1 de U + 1 de V. |
| **Textura I8 / baldosas (tiles)** | I8 = un byte por píxel (solo intensidad). La GPU de la Wii no guarda las texturas fila por fila, sino en baldosas de 8×4 píxeles (32 bytes seguidos cada una), para leer de una vez píxeles vecinos en las dos direcciones. Como organizar una memoria por bloques para que un acceso traiga una zona y no una tira. |
| **GQR / psq_l / psq_st** | `psq_l`/`psq_st` = cargar/guardar un par de números de las paired singles. El GQR (un registro de configuración) dice en qué formato están en memoria: float, o entero de 8/16 bits con una escala 2^n. Al cargar, el procesador de la Wii convierte y escala solo, en hardware (como un ADC con ganancia programable). El IDCT del THP guarda así sus resultados: ÷8 y recortado a 0..255 en una instrucción. |
| **En línea / fuera de línea (inline)** | Una función "en línea" se copia dentro de quien la usa (sin llamada); "fuera de línea" se llama y se vuelve (salto, guardar registros, volver). En un lazo que corre millones de veces, la llamada pesa más que la cuenta. Como un componente soldado en la placa frente a uno en otra placa con cable y conectores. |
| **Reemplazo nativo (override)** | Cambiar una función traducida del juego por una escrita por nosotros que hace el mismo trabajo, y que reciba todas las llamadas. Aquí se hace al compilar: `-Dfunc_X=func_X_traducida` (una macro que le cambia el nombre a la original en su shard) y nuestro archivo define `func_X`. |
| **Truncar / redondear** | Truncar = cortar los decimales (2,9 → 2). Redondear = ir al más cercano (2,9 → 3). Truncar da en promedio medio escalón menos: una diferencia de nivel de continua de 0,5 LSB. |
| **Caché bloqueada (locked cache)** | Un truco de la Wii: 16 KB de la caché del procesador se usan como memoria de trabajo propia, con transferencias DMA. El THP del juego la usa; el nativo no la necesita. |
| **Toque por CDP (`Input.dispatchTouchEvent`)** | Un dedo simulado por la "puerta de servicio" de Chrome: el navegador lo trata igual que un dedo de verdad, a diferencia de un evento inventado desde la página. |

### Las pruebas y el control de versiones

| Término | Qué es y qué hace |
|---|---|
| **Banco de pruebas (`banco/`)** | Páginas que prueban una pieza cada una y muestran ✓/✗, igual que un banco de pruebas de laboratorio con su instrumento por cada medición. |
| **Artifact** | Una página publicada en claude.ai (privada) para ver un resultado desde otro equipo. |
| **Playwright** | Programa que maneja un Chrome automáticamente (hace clics, toques, lee la pantalla) para probar páginas sin una persona. |
| **git, repositorio (repo), commit** | git guarda la historia de todos los cambios de un proyecto. Un repo es esa carpeta con historia. Un commit es una "foto" guardada de un momento, con su descripción. |
| **diff / parche** | La lista exacta de líneas que cambiaron entre dos versiones. Un parche (`parches/*.diff`) es un diff guardado para volver a aplicarlo sobre otra copia. |
| **`.gitignore`** | La lista de lo que git NUNCA debe guardar (aquí: todo lo del juego). |
| **Tabla hash (hash map)** | Una forma de encontrar algo por su nombre sin recorrer la lista entera: del nombre se calcula un número (su hash) que dice en qué "cajón" está. Como un tablero de fusibles rotulado: vas directo al circuito, no pruebas uno por uno. Buscar entre 7.581 archivos pasa de compararlos todos a mirar 1 o 2. |
| **Tabla de símbolos (del traductor)** | La lista que deja el traductor de WiiCompiled con la dirección de cada función del juego y su nombre (por ejemplo `0x8015DF4C` = `DVD::ConvertPathToEntrynum`). Como el plano con los rótulos de cada borne: sin él solo hay números. |
| **Reemplazar una función (copia del shard)** | Para cambiar una función traducida por una nuestra sin retraducir: se copia el archivo C++ (shard) que la contiene, en la copia se le cambia el nombre solo a su definición (`func_X` → `func_X_traducida`), y nuestro archivo define `func_X`. Así toda llamada, incluso las del mismo archivo, llega a la nuestra, y la nuestra puede llamar a la original. Como poner un puente en la bornera: todo lo que entraba al equipo viejo pasa ahora por el nuevo, que puede seguir usándolo. |
| **Proceso de GPU del navegador** | Chrome no deja que la página hable directo con la tarjeta de video: le manda los pedidos a un proceso aparte (el de GPU), que los traduce para Direct3D (en Windows) y los ejecuta en orden. Si uno tarda (compilar un pipeline), los de atrás esperan, como una línea de producción con una sola máquina. |
| **Pipeline asíncrono / precalentar** | Pedir un pipeline "en segundo plano" (`createRenderPipelineAsync`): el navegador lo compila en otros hilos y avisa cuando está, sin frenar el dibujo. Precalentar = pedirlos antes de que hagan falta (al arrancar), como poner en marcha los motores antes de cargar la línea. |
| **Semilla (de pipelines)** | La lista de pipelines que usó el juego en una partida de prueba (414), guardada en `pipelines.bin` junto al `.wasm`. Con ella, hasta la primera visita llega precalentada. Son descripciones de cómo dibujar, no imágenes ni código, pero salen del juego: van con el `.wasm` a R2, nunca a git. |
| **Latencia (de la red)** | El tiempo que tarda un pedido en empezar a recibir respuesta, aunque sea de 1 byte: en la misma PC ~1 ms; hasta R2 por internet ~30–80 ms. Como el retardo de una línea larga: no importa el ancho de banda, cada ida y vuelta cuesta lo mismo. 40 pedidos uno detrás de otro × 50 ms = 2 s. |
| **Lectura adelantada (read-ahead)** | Traer el pedazo siguiente de un archivo antes de que lo pidan, porque quien lee en orden casi seguro lo va a pedir. Como el búfer de un reproductor de CD con antisacudidas: lee por delante y la música no se corta. |
| **Aviso de lectura** | Cuando el juego busca un archivo en el índice del disco y lo encuentra, casi siempre lo lee enseguida. `rutas_nativo.cpp` le avisa a la página en ese momento, y la página empieza a bajarlo en paralelo con los otros avisos. |
| **Fila de prioridad baja** | Pedidos que solo salen cuando no hay nada urgente: de a pocos, espaciados, y nunca mientras el juego está esperando una carga. Como cargar baterías de noche, cuando nadie usa la red eléctrica. |
| **BRSAR / grupo de sonido** | El archivo de sonido de Mario Kart Wii (`revo_kart.brsar`, 102 MB), partido en ~490 grupos (los sonidos de cada personaje, pista y menú). Al principio tiene una tabla con dónde empieza y termina cada grupo (formato público de Tockdom). |
| **Bloqueo de la caché HTTP (cache lock)** | Chrome no deja que dos pedidos al MISMO archivo pasen a la vez por su caché HTTP: los pone en fila, aunque pidan pedazos distintos. Con `cache: 'no-store'` el pedido no pasa por esa caché y van en paralelo. |
| **Semilla de bloques** | La lista de pedazos del disco que el juego leyó después del título en varias partidas de prueba (los que se repiten en ≥ 2 corridas: no los de los personajes al azar). La primera visita los baja de antemano con prioridad baja. Va con el `.wasm` (R2), nunca a git. |
| **Rama (branch) / PR** | Rama = una línea de trabajo paralela. PR (pull request) = la solicitud de juntar una rama con la principal, para revisarla antes. |
| **rksys.dat / licencia** | La partida de Mario Kart Wii: un solo archivo de 2,8 MB con hasta 4 licencias (los perfiles del principio, cada una con su Mii, récords, VR). Formato público (mkwiiki/Tockdom): empieza con "RKSD", cada licencia con "RKPD", y al final una suma de control. |
| **CRC (suma de control)** | Un número calculado de todos los bytes de un archivo, guardado al final. Si cambia un solo bit, el número ya no cuadra y se sabe que el archivo está dañado. Como el bit de paridad de una línea serie, pero de 16 o 32 bits. rksys.dat usa CRC-32 (el de zip); la base de Mii, CRC-16/XMODEM. |
| **Copia de respaldo automática** | Antes de reemplazar la partida (cargar un archivo, borrar, restaurar, guardar Mii), la página guarda una "foto" de todo lo guardado en otra base del navegador, y se queda con las últimas 8. Como el disyuntor que deja volver atrás: un error se deshace con un clic. |
| **Mii / RFL_DB.dat** | Cada Mii son 74 bytes con todos sus rasgos apretados en campos de pocos bits. La Wii guarda hasta 100 en su memoria interna, en `RFL_DB.dat`, que es donde Mario Kart Wii los busca al elegir el Mii de la licencia. |
| **Campo de bits** | Varios datos chicos metidos en un mismo número: por ejemplo, en 16 bits van "es chica" (1 bit), mes (4), día (5), color favorito (4)… Como un registro de un microcontrolador, donde cada grupo de bits es un ajuste distinto. |
| **Memoria del juego (de la Wii) dentro del wasm** | El juego traducido sigue usando direcciones de la Wii (0x80000000…). El runtime guarda esa memoria en dos bloques dentro de la memoria del wasm; `mkw_web_mem` le dice a la página dónde quedó cada bloque, y la página lee de ahí (en big-endian) sin copiar nada. Como poner una punta de osciloscopio en un bus: se mira lo que pasa sin cambiar el circuito. |
| **Big-endian** | El orden de los bytes de un número: la Wii pone primero el byte más grande (0x12345678 queda 12 34 56 78); las PC, al revés. Por eso la página lee con `getUint32(p, false)`. |
| **Sección / página (del menú del juego)** | Cómo organiza Mario Kart Wii sus pantallas: la sección es el "modo de pantalla" (menú principal, un jugador, carrera…), y dentro de ella se apilan páginas (elegir personaje, kart, copa…). Leerlas es saber en qué pantalla está el juego. |
| **Racedata / CupsConfig** | Racedata: el objeto del juego con la configuración de la carrera (modo, cilindrada, pista). CupsConfig: el de Pulsar (el motor de Retro Rewind) con la copa y la pista elegidas entre sus ~360 pistas. Lo encontramos buscando en la memoria la estructura que cambiaba al elegir copas distintas. |
| **Piloto (lazo cerrado)** | El programa de la página que maneja los menús solo: mira en qué página está el juego, aprieta el botón que corresponde y comprueba el resultado (el modo, la pista); si no es lo pedido, vuelve atrás y corrige. Como un regulador con realimentación, en vez de un temporizador a ciegas. |
| **BMG** | El formato de las tablas de textos del juego (cada mensaje con su número). En la de Retro Rewind, el mensaje 0x20000 + n es el nombre de la pista n: de ahí salen los nombres de la lista para elegir pista. |
| **Caras de partida (presets)** | Mii ya armados para empezar, como los "invitados" del juego: se elige uno y solo se le pone nombre y color. Los de la página los armamos nosotros (no son los datos de Nintendo). |

| **Copia de una respuesta (`clone()`)** | Pedirle al navegador dos lecturas de la MISMA descarga: los bytes llegan una vez por la red y se reparten a dos lectores. La barra de descarga (§106) lee una copia solo para contar; el juego lee la original, intacta. Como una pinza amperimétrica: mide la corriente sin cortar el cable. |
| **Ráfaga (de descargas)** | Un grupo de pedidos que se superponen en el tiempo (el juego pide varias cosas casi a la vez). La barra muestra lo recibido de lo esperado en la ráfaga actual y vuelve a cero cuando todo queda quieto un segundo. |
| **Puerto (del mando)** | Cada uno de los 4 enchufes de mando de la GameCube: el puerto 1 es el jugador 1. La página decide qué mando del PC va a cada puerto; desde §106 la persona lo elige («Jugador 1–4»), como el selector de entrada de una mesa de sonido. |
| **Resolución interna / supermuestreo** | Dibujar la imagen a más pixeles de los que tiene la pantalla y después achicarla: cada pixel final sale del promedio de varios, así los bordes quedan suaves (es el antialiasing de mejor calidad). Como medir con más muestras por segundo y promediar: la curva sale más limpia, pero hay más que procesar. |
| **Imágenes intermedias (interpolación de cuadros)** | El juego calcula 60 cuadros por segundo; el motor dibuja además imágenes «entre medio» de dos cuadros (120 o 180 por segundo) para monitores rápidos. Es solo la imagen: la física sigue a 60. Como una tele de 120 Hz que inventa los cuadros del medio de una película. |

---

### La red en línea (§58)

| Término | Qué es y qué hace |
|---|---|
| **Red, paquete** | Las consolas se hablan mandándose **paquetes**: trozos de bytes con una dirección de destino. Como cartas: cada una lleva el destinatario escrito y viaja sola. |
| **Dirección IP** | El "número de casa" de cada aparato en la red (p. ej. `10.77.0.2`). En nuestra red de juguete: `10.77.0.1` es el servidor WFC, `10.77.0.2` la pestaña anfitriona, `10.77.0.3`… las demás. |
| **Puerto** | Dentro de un aparato, el número de "ventanilla" a la que va el paquete (el servidor de entrada escucha en 29900, el de salas en 28910…). IP + puerto = dirección completa, como edificio + departamento. |
| **Socket** | El "enchufe" de red que abre un programa: un extremo por el que manda y recibe. El juego abre los suyos con las funciones POSIX `socket`, `connect`, `sendto`, `recv`…; las reemplazamos por las nuestras (`web/red/red_web.cpp`), que hablan con la página. |
| **UDP** | Forma de mandar paquetes sueltos, sin acuse de recibo: rápida, pero alguno se puede perder o llegar desordenado. La carrera va por UDP (60 veces por segundo importa más llegar a tiempo que llegar todo). Como una radio: se transmite y ya. |
| **TCP** | Forma de mandar un **chorro** de bytes con acuse de recibo y en orden: si algo se pierde, se repite. La entrada al servidor (GPCM) va por TCP. Como una llamada telefónica: se conecta primero y se confirma lo dicho. |
| **DNS** | El "directorio telefónico": convierte un nombre (`gpcm.gs.play.rwfc.net`) en una IP. El nuestro contesta siempre `10.77.0.1`, así el juego cree hablar con los servidores de Retro WFC y habla con el nuestro. |
| **HTTP / SOAP** | HTTP: el idioma de las páginas web (pedido "POST /ac" → respuesta). SOAP: mensajes en XML dentro de HTTP; lo usa el "almacén" SAKE. |
| **WFC (Wi-Fi Connection)** | El servicio en línea de Nintendo para la Wii (cerrado en 2014). Retro Rewind usa **Retro WFC**, uno hecho por la comunidad. Nosotros escribimos uno propio que corre **dentro de la pestaña anfitriona** (`web/navegador/wfc.mjs`): nadie sale a internet. |
| **NAS** | El primer servidor al que entra la consola: crea la cuenta y da un **token** (un pase de entrada) y un reto. |
| **GPCM** | El servidor de "presencia" de GameSpy (TCP 29900): login con el token, perfil, lista de amigos, estado. Mientras la consola está en línea, esta conexión queda abierta (es su "línea telefónica" con el servidor). |
| **QR2** | "Query & Reporting" de GameSpy (UDP 27900): cada consola manda un **latido** cada ~10 s con sus datos (cuántos jugadores tiene, si abrió una sala, su VR…). Así el servidor sabe quién está en línea. |
| **Lista de salas (server browser)** | TCP 28910: la consola pide "¿quién está jugando con estas condiciones?" con un filtro tipo SQL; el servidor contesta con las consolas que cumplen, **cifrado** con enctypeX. También pasa mensajes de una consola a otra ("quiero entrar a tu sala"). |
| **enctypeX** | El cifrado de GameSpy para esa lista: un cifrado de flujo (cada byte se mezcla con un byte "al azar" que sale de una clave y de dos retos), parecido a RC4. Como un codificador con una secuencia pseudoaleatoria que solo el que conoce la semilla puede repetir. |
| **NAT / NATNEG** | En internet, los routers (NAT) esconden las consolas detrás de una sola IP. NATNEG (UDP 27901) es el servidor que ayuda a dos consolas a "encontrarse" a través de sus routers. En nuestra red no hay routers: solo junta a las dos y le dice a cada una la dirección de la otra. |
| **SAKE** | El "almacén" de GameSpy (SOAP): Mario Kart guarda ahí su FriendInfo (el Mii que ven los amigos). |
| **Anfitrión de la sala (host)** | La consola que abrió la sala; las demás se unen a ella. Distinto del "anfitrión del WFC" (la pestaña donde corre nuestro servidor). |
| **aid** | El número de cada consola dentro de una sala (0, 1, 2…). |
| **Latencia** | El tiempo que tarda un paquete en llegar. En la misma PC, casi cero; por internet, decenas de ms. |
| **Pila de red (stack)** | El programa que maneja los sockets de un aparato: a qué socket va cada paquete que llega, qué conexiones TCP hay. La nuestra es `crearPila` en `web/navegador/red.mjs` (una por pestaña y otra para el WFC). |
| **Conmutador / enlace** | Lo que lleva paquetes de una pila a otra: en una pestaña, un conmutador en memoria; entre pestañas, un **BroadcastChannel** (un canal del navegador entre pestañas del mismo sitio). Más adelante, WebRTC entre computadores. Como un switch de red. |
| **BroadcastChannel / WebRTC** | BroadcastChannel: mensajes entre pestañas del mismo navegador. WebRTC: conexión directa entre dos navegadores en distintos computadores (como BT3); Firebase solo sirve para presentarlos (la "señalización"). |
| **Pila de llamadas (call stack) / LR** | Cuando una función llama a otra, guarda "a dónde volver" (el registro **LR**, link register). Recorriendo esas direcciones guardadas se sabe quién llamó a quién: la **cadena de llamadas**. Como seguir un cable desde la carga hasta el interruptor que la prendió. |
| **Gancho (hook) de depuración** | Reemplazar una función del juego por una nuestra que anota algo y después llama a la original. No cambia el comportamiento; es una punta de prueba. |
| **AFK** | "Away from keyboard": jugador que no maneja. El juego en línea saca a quien no se mueve por un rato (para no trabar la carrera de los demás). |
| **Perfil (profile id)** | El número de cada jugador en el servidor. La consola lo guarda en su partida la primera vez y, al volver a entrar, espera el mismo. |

### La malla WebRTC y el VR (§59)

| Término | Qué es y qué hace |
|---|---|
| **Malla (mesh)** | Cada navegador de la sala conectado **directo** con cada uno de los otros (no a un servidor central). Con 4 jugadores son 6 conexiones. Como una red eléctrica mallada: cada nodo tiene línea con los demás. `web/navegador/malla.mjs`. |
| **Canal de datos (WebRTC datachannel)** | Un "cable" dentro de una conexión WebRTC. Abrimos dos por par: **udp** (sin orden y sin repetir: si un paquete se pierde, se pierde, como lo espera la carrera) y **tcp** (en orden y confiable, para la entrada al servidor). |
| **Señalización / buzón** | Antes de conectarse directo, dos navegadores tienen que intercambiar unos "datos de contacto" (oferta, respuesta, candidatos). Eso viaja por un buzón: Firebase en el sitio (como BT3), o un BroadcastChannel falso en el banco. Después el buzón ya no se usa. |
| **ICE / candidato** | Las formas posibles de llegar a un navegador (su IP local, la IP pública que ve un servidor STUN…). WebRTC prueba las parejas hasta que una funciona. Como probar varias rutas de cable hasta que hay continuidad. |
| **Router (enrutador) de la malla** | Lo que decide por dónde mandar cada paquete según su IP de destino: si la IP es de esta pestaña, directo; si es de otro navegador, por la malla. Cada navegador anuncia a los demás qué IPs tiene. `crearRouterMalla` en `red.mjs`. |
| **JSON** | Una forma de escribir datos como texto: `{"found":1,"vr":7777}`. Claves entre comillas y sus valores. Casi toda la web lo usa. |
| **Coma flotante (float32)** | Una forma de guardar números con decimales en 4 bytes (signo, exponente y mantisa, como la notación científica: 7,777 × 10¹). Retro Rewind guarda el VR así, dividido por 100: 77,77 = VR 7.777. |
| **Firestore / reglas** | La base de datos de documentos de Firebase (la que ya usa el sitio para los récords). Las **reglas** son el "interruptor de seguridad" del lado de Google: deciden quién puede leer o escribir cada documento (aquí: todos leen, cada uno escribe solo el suyo). |
| **Espía (de la pila)** | Una función que ve cada trozo TCP que el juego manda, sin cambiarlo; con ella la página lee el VR que el juego le informa al servidor. Como una pinza amperimétrica: mide sin cortar el cable. |
| **Marco de pila (stack frame)** | El pedacito de memoria que cada función usa mientras corre para sus variables locales. Al terminar queda escrito hasta que otra función lo pisa: leyéndolo justo después se sabe hasta dónde llegó. |

### La sala del sitio (§60)

| Término | Qué es y qué hace |
|---|---|
| **Realtime Database** | La base de datos de Firebase que ya usa el sitio para las salas, los logros y el chat: un árbol de datos (como carpetas) que se actualiza en vivo en todos los navegadores. El VR y los récords van ahí (`mkw/vr`, `mkw/records`), no en Firestore, que el sitio no usa. |
| **Registro de jugadas (log) y reductor** | En el sitio, una sala no guarda "el estado": guarda la lista de cosas que pasaron (`jugadas`: «empieza», «vuelve», «ajuste»…), una tras otra y sin borrar. El **reductor** (`redMkw`) relee esa lista desde el principio y calcula el estado (quién es el anfitrión, si están corriendo). Como un contador de energía: no guarda "cuánto queda", suma lo registrado. |
| **Cartero (`mkw.js` del sitio)** | El módulo de la página del sitio que hace de intermediario entre la sala y el juego en su iframe: le pasa los mensajes del buzón, le da el VR de la cuenta y dibuja el vestíbulo. No toca la carrera. |
| **Vestíbulo** | La pantalla de la sala antes de correr: quiénes están, su VR, el anfitrión, la CPU de relleno y el botón «¡A correr!». |
| **Nodo** | El número de cada jugador en la red del juego: su dirección es 10.77.0.<nodo>. Se da por orden de llegada (2, 3, 4…) y no cambia aunque otros se vayan. |
| **Vigilante (watchdog)** | Un reloj que revisa si algo se quedó pegado y, si pasa demasiado tiempo, lo destraba. Como el relé de un temporizador de seguridad. |

### La carrera sincronizada con CPU (§61)

| Término | Qué es y qué hace |
|---|---|
| **Lockstep (paso a paso sincronizado)** | Todas las consolas de la sala corren la **misma** carrera offline (12 karts: los humanos y la CPU), y ninguna avanza un cuadro hasta tener los botones de todos para ese cuadro. Como varios relojes esclavos que solo dan un paso cuando llega el pulso común. |
| **Determinismo** | Que el juego, con las mismas entradas, dé exactamente el mismo resultado, bit por bit, en todas las consolas. Es lo que hace posible el lockstep: solo viajan los botones, no la posición de cada kart. |
| **Desincronización (desync)** | Cuando dos consolas, con los mismos botones, calculan algo distinto: desde ahí cada una ve otra carrera. Como dos osciladores "iguales" que se separan por una diferencia mínima. |
| **Huella** | Un número que resume el estado de la carrera (el avance de los 12 karts mezclado). Cada 120 cuadros las consolas comparan su huella: si coinciden, siguen viendo la misma carrera. Como comparar la suma de verificación de dos archivos. |
| **Retraso de entrada (3 cuadros)** | Lo que tocas ahora vale para 3 cuadros después (50 ms): es el tiempo que tienen tus botones para llegar a los demás antes de hacer falta. |
| **Plantel** | Quién corre en cada uno de los 12 puestos: personaje, vehículo, si es humano o CPU, y el mando de cada humano. Lo arma la sala con una semilla, así es igual en todas las consolas. |
| **Kart títere** | El kart de un humano de la sala: para el juego es un "CPU" (así no arma pantalla dividida), pero lee el mando de su dueño en vez de la inteligencia artificial. |
| **PPC_MftbCarrera** | El reemplazo del reloj del procesador (`mftb`) en las 7 funciones que siembran el azar de la carrera: en la carrera sincronizada cuenta de a pasos fijos en vez de leer la hora, así el azar sale igual en todas. |
| **Tabla de pantallas (hud mapping)** | En Racedata, qué jugador tiene la pantalla (la cámara y el HUD). Parte de la lógica del juego también la mira: si es distinta en cada consola, la carrera se separa. Ahora es la misma en todas (puesto 0) y solo la cámara y el HUD se apuntan al kart de cada uno. |
| **HUD** | Lo que se dibuja encima de la carrera: puesto, vuelta, tiempo, ventana del objeto, mapa. |
| **Corte en dos pasos (two-phase commit)** | Cuando alguien se va, antes de seguir sin él se pregunta a todos hasta qué cuadro tienen sus botones y se corta después del último que tenga cualquiera. Así nadie usó botones "de verdad" en un cuadro que otro ya marcó "sin nadie". Como un interruptor de transferencia que espera a que todas las fases confirmen. |
| **Decisor** | El primer humano de la sala que sigue conectado (y que no es al que se espera): él decide los cortes, para que todos corten en el mismo cuadro. |

### Las dos desincronizaciones escondidas (§62)

| Término | Qué es y qué hace |
|---|---|
| **Pulsar** | El "motor" de mods sobre el que está hecho Retro Rewind: código propio que se mete en el juego en lugares elegidos. Cambia, por ejemplo, el bucle principal. |
| **Kamek / overlay** | Las dos maneras en que Pulsar cambia el juego: un **kamek** es un pedacito de código nuevo al que el juego salta desde un punto (`rr_kamek_81806568`); un **overlay** reemplaza una función entera del juego por la suya (`rr_overlay_8000951C` = el bucle principal). Como soldar un puente en una placa o cambiar un integrado entero por otro. |
| **Compensación de lag (salto de dibujo)** | Lo que hace Pulsar si el juego va atrasado respecto al reloj real: se salta el dibujo de un cuadro y corre la lógica una vez más para alcanzarlo. Como un motor que, si se atrasa, se saltea un paso del ciclo para recuperar el sincronismo. Depende de lo cargada que esté cada PC: por eso separaba las carreras. |
| **Refresco de pantalla (vblank/retrace)** | El pulso de 60 Hz de la pantalla: cada vez que termina de dibujarse una imagen. El juego cuenta estos pulsos para saber si va a tiempo. |
| **ModelDirector** | La pieza del juego que copia la posición de cada kart (lo que calcula la física) a su **modelo** 3D (lo que se dibuja). En MKW lo llama el dibujo, no la lógica. |
| **ItemPlayer** | La ficha de objetos de cada jugador (584 bytes): qué objeto tiene, si la ruleta está girando, cuántos le quedan. |
| **Reloj por lugar** | El reemplazo del reloj fijo de §61: en vez de un contador para todo el juego, cada lugar que pide la hora recibe un número que sale solo del cuadro de la carrera y de quién la pide. Como darle a cada aparato su propio generador de base de tiempo en vez de colgarlos todos del mismo. |
| **lr (link register)** | El registro del procesador PowerPC que guarda a dónde volver cuando termina una función: sirve como "firma" de desde dónde la llamaron. |
| **Punto de vigilancia (watchpoint)** | Una trampa que avisa cada vez que alguien escribe en una dirección de memoria elegida, con la pila de llamadas (quién fue). Como una punta de osciloscopio con disparo en un nodo: te dice el instante y la causa. |
| **Huella sin punteros** | Una huella de un objeto que ignora los campos que son direcciones de memoria (cambian de una corrida a otra aunque el estado sea el mismo) y compara solo los valores. |

### La página que se congelaba al terminar la carrera en línea (§63)

| Término | Qué es y qué hace |
|---|---|
| **Reloj de pared** | El reloj "de verdad" (el de la pared, el del PC), en contraposición al refresco del monitor. En línea (`?red`) el juego cuenta sus cuadros con el reloj de pared, no enganchado al monitor (§58): así todas las consolas de la sala avanzan al mismo ritmo aunque sus monitores refresquen distinto. |
| **Espera enganchada / sin enganche** | Las dos maneras en que el runtime espera el próximo cuadro en el navegador. **Enganchada**: le pide a la página que lo despierte en el refresco del monitor justo antes de la hora (la página usa `requestAnimationFrame`). **Sin enganche**: espera por el reloj de pared. Antes de §63, sin enganche el runtime **giraba** (espera activa) sin soltar nunca el hilo de la página. |
| **Temporizador anidado (mínimo de 4 ms)** | Un `setTimeout` pedido desde adentro de otro temporizador. Después de 5 niveles, Chrome lo demora al menos 4 ms aunque se pida 0 o 1 ms (una regla de los navegadores para que una página no gaste la CPU con temporizadores en cadena). Por eso las esperas del juego piden el temporizador desde una **tarea nueva** (un mensaje de `MessageChannel`), que empieza el conteo de niveles de cero. Es como un relé con tiempo mínimo de conmutación: por debajo de eso, pedir menos no sirve. |
| **Pestaña oculta** | Una pestaña que no se ve (otra encima, ventana minimizada). Chrome deja de llamar a `requestAnimationFrame` y retrasa los `setTimeout` hasta 1 s. Si el juego dependiera de ellos, en una pestaña oculta andaría a 1 cuadro por segundo y se atrasaría de la sala; por eso ahí la espera solo cede una vuelta y sigue. |
| **Latido (sonda de respuesta)** | Para saber si la página está "viva", la prueba pone un `setInterval` de 100 ms y mide el hueco más largo entre dos llamadas. Si la página atiende bien, los huecos son ~100 ms; si el hilo está tomado, crecen (700 ms) o la prueba ni siquiera puede leer la página (`page.evaluate` no vuelve). Es como medir el período de un oscilador para saber si alguien lo está cargando. |
| **Pausa de presentar** | El momento, después de terminar de dibujar un cuadro, en que aurora espera a que el navegador "tome" el canvas (lo lleve a la pantalla) antes de seguir con el próximo cuadro (§54). Ahí la página recibe su turno. |

### Guardar el trabajo y publicarlo (§64)

| Término | Qué es y qué hace |
|---|---|
| **Push / fetch** | `push` = mandar los commits de una rama de este PC a GitHub (el repo "remoto"); `fetch` = traer de GitHub lo nuevo que hicieron otros, sin mezclarlo todavía. Como sincronizar dos copias de un mismo plano: una en el escritorio y otra en el archivo central. |
| **Merge (juntar)** | Mezclar una rama con otra (aquí, la del PR con `main`, lo que publica GitHub Pages). Solo lo hace el dueño o se hace cuando él lo dice: mientras no, el PR es una propuesta que se puede revisar sin que cambie el sitio. |
| **Vector de prueba** | Una entrada con su resultado conocido de antemano, publicada por quien definió el algoritmo (por ejemplo, el RFC 1321 dice que el MD5 de "abc" es `900150983cd24fb0d6963f7d28e17f72`). Si nuestro programa da lo mismo, está bien hecho. Como calibrar un instrumento contra un patrón. |
| **Carrera entre procesos (race condition)** | Un error que aparece o no según cuál de dos cosas que corren a la par llega primero (aquí: la página borrando la semilla y el juego leyéndola). Es como dos señales que llegan a un flip-flop sin sincronizar: el resultado depende de cuál gana por nanosegundos. Se arregla imponiendo el orden (esperar a que una termine antes de la otra), no "esperando un poquito". |
| **Etapa (del plan)** | Un grupo de tareas que se cierra entero antes de pasar al siguiente (A: poner el trabajo a salvo, B: publicar en privado, C: en línea…). Están en `PLAN.md`, "Lo que falta, en orden". |

### Publicar en privado: el Worker, el token y R2 (§65)

| Término | Qué es y qué hace |
|---|---|
| **Token de Firebase (JWT)** | Un texto firmado por Google que dice "esta persona inició sesión, es tal uid, vale hasta tal hora" (una hora). El Worker revisa la firma con las claves públicas de Google, el proyecto y la hora; si todo calza, sabe quién pide sin preguntarle a nadie. Como una credencial con foto, holograma y fecha de vencimiento. |
| **Pregunta previa (preflight de CORS)** | Antes de un pedido "no simple" a otro sitio (por ejemplo, con la cabecera `Authorization`), el navegador pregunta primero con `OPTIONS` si está permitido; el servidor contesta qué cabeceras y métodos acepta. El navegador recuerda la respuesta un rato, **por dirección**: por eso hay una pregunta previa por cada archivo distinto. Como pedir permiso en portería la primera vez que vas a una oficina. |
| **Blob** | Un pedazo de bytes guardado en la memoria de la página, con una dirección local (`blob:…`) que solo ella entiende. Sirve para importar un programa que se bajó con fetch (con el token), porque `import()` no deja poner cabeceras. |
| **Bucket y prefijo (R2)** | Un bucket es un "disco en la nube" de Cloudflare R2; cada archivo es un objeto con una llave (su nombre completo). El prefijo es el comienzo común de las llaves: todo lo de Mario Kart empieza con `mkw/`. Hasta §104 convivía así con los pedazos de BT3 en el mismo bucket; desde §105 Mario Kart tiene su propio bucket (con las mismas llaves). |
| **API S3 y firma (Signature V4)** | S3 es la forma de hablar con un "disco en la nube" que inventó Amazon y que R2 también entiende. Cada pedido va firmado: una cadena de cuentas HMAC-SHA256 con el secreto, la fecha, la región y el contenido del pedido. El secreto no viaja; viaja la firma, que solo vale para ese pedido y por unos minutos. Como un sello lacrado que depende del contenido de la carta. |
| **HMAC** | Una huella (SHA-256) que se calcula mezclando el mensaje con una clave secreta: solo quien tiene la clave puede producirla o comprobarla. |
| **Vector de prueba (de una firma)** | El ejemplo publicado por AWS con entradas fijas y su firma esperada (`f0e8bd…`). Si nuestra cuenta da exactamente esos 64 dígitos, está bien hecha: con un error cualquiera daría otros. |
| **Arnés (de prueba)** | Un programa que monta alrededor de una pieza lo que en producción pone otro (aquí: el bucket, las claves de Google y la red alrededor del Worker), para probar la pieza de verdad sin el resto. Como un banco de pruebas con fuente, carga y osciloscopio alrededor de una placa. |
| **Caché del borde (Cloudflare)** | Cloudflare tiene servidores en muchas ciudades (el "borde"); el Worker corre en el más cercano. R2 no tiene servidores en Sudamérica, así que cada pedazo viaja lejos, salvo que el Worker lo deje guardado en el caché de ese servidor cercano (solo funciona con un dominio propio, no en `*.workers.dev`). |
| **Reino (realm) de JavaScript** | Cada página y cada marco (iframe) tiene su propio juego de clases de JavaScript: un `Uint8Array` hecho en el marco del juego no es «`instanceof Uint8Array`» para la página de la sala, aunque tenga los mismos bytes. El SDK de Firebase revisa así lo que le pasan y rechaza lo del otro reino; por eso lo que va y viene entre el marco y la sala se **copia**. Como dos tableros con distinto estándar de enchufe: el aparato funciona igual, pero sin adaptador no entra. |

### Botones escondidos, la cortina y entrar directo al juego (§66)

| Término | Qué es y qué hace |
|---|---|
| **Control (de un menú del juego)** | Cada cosa que se ve en una pantalla del menú (un recuadro, un texto, un botón) es un objeto en la memoria con su posición, su dibujo y un byte **escondido** (+0x80: 1 = no se dibuja). Un **botón** además tiene un "manipulador" que recibe el mando y unos **bits de quién puede elegirlo** (uno por jugador; 0 = nadie). Como en un tablero: cada piloto luminoso y cada pulsador es un componente con su borne de habilitación. |
| **Vtable (la firma de una clase)** | La primera palabra de cada objeto de C++ apunta a la tabla de funciones de su clase: todos los botones de la misma clase tienen ahí el mismo número (por ejemplo 0x808B776C = PushButton). Sirve para reconocer qué es un objeto mirando la memoria. Como el código de colores de una resistencia: dice qué es sin desarmarla. |
| **Administrador de mandos (de una página)** | El objeto de cada pantalla que reparte el mando entre sus botones (a quién mover el cursor, a quién le toca la A). Cada botón guarda su dirección: así se sabe de qué pantalla es un botón aunque viva lejos en la memoria. |
| **Cortina** | Una capa de la página encima del juego que lo tapa mientras carga y mientras el piloto recorre solo los menús; se va con un fundido cuando hay algo que mirar (el título, la carrera o la sala). Es nuestra (no tiene nada del juego). Como el telón de un teatro mientras cambian la escenografía. |
| **Portada** | La tarjeta de inicio de la página (título, «Tu partida», «Jugar» y la lista de modos). Desde §66 no aparece: la página entra directo al juego. Queda con `?portada=1` para las pruebas que miran la página sin el juego. |

### El menú de inicio «JloKart Wii» y el ensayo general (§67)

| Término | Qué es y qué hace |
|---|---|
| **Máscara (de una imagen)** | Una segunda imagen del mismo tamaño, en blanco y negro, que dice qué píxeles se tocan (1) y cuáles no (0). Aquí marca los 4 botones pintados y la flecha que se borran. Como la cinta de pintor: donde está, entra la pintura nueva; donde no, queda lo de antes. |
| **Relleno «pull-push» (empujar y tirar)** | Una forma de rellenar un hueco en una imagen: se achica la imagen a la mitad una y otra vez promediando solo los píxeles buenos (el hueco se va cerrando), y al volver a agrandarla cada tamaño usa lo suyo donde lo tiene y lo de más abajo para el hueco. Da un relleno suave, parecido a un fondo desenfocado. Como estimar la temperatura en un punto sin sensor con el promedio de los sensores vecinos, primero los cercanos y después los lejanos. |
| **Relleno por filas** | Rellenar cada fila del hueco con una mezcla en línea recta entre el color de su borde izquierdo y el del derecho (interpolación lineal). Continúa las rayas horizontales de velocidad del fondo. Es lo mismo que unir dos puntos de una curva con una recta. |
| **Grano (ruido de la imagen)** | La variación fina, píxel a píxel, que tiene toda foto o ilustración. Un relleno perfectamente liso se nota "plástico"; por eso se le agrega un ruido de la misma intensidad que el de la imagen. Como el ruido de fondo de una señal: si de repente desaparece en un tramo, se nota el corte. |
| **WebP** | Un formato de imagen comprimida (como JPG, pero ~30 % más chico a la misma calidad). La imagen del menú pesa 264 KB así. |
| **Blob y dirección local (`blob:`)** | Un *blob* son bytes que la página tiene en memoria (aquí, la imagen que llegó del Worker). `URL.createObjectURL` le da una dirección local (`blob:…`) que una etiqueta `<img>` puede mostrar como si fuera un archivo de internet. Sirve porque la imagen se pide con el token (una cabecera que un `<img>` normal no sabe poner). |
| **Vidrio esmerilado (`backdrop-filter`)** | Un efecto de la página que desenfoca lo que hay detrás de un elemento, como un vidrio pavonado. El panel de los botones lo usa para que la zona rellenada se vea como parte del menú. |
| **Fase de captura (de un evento)** | Cuando se aprieta una tecla, el navegador avisa primero "de afuera hacia adentro" (captura) y después "de adentro hacia afuera" (burbuja). El menú escucha en la captura de la ventana: ve la tecla antes que nadie y, si la usa, la corta (`stopImmediatePropagation`) para que no le llegue al juego. Como un relé de protección que actúa antes que el resto del circuito. |
| **Flanco (botón recién apretado)** | Lo que el menú mira de un botón del mando no es "está apretado" sino "pasó de suelto a apretado" entre una lectura y la siguiente: así un botón que se mantiene no elige diez veces. Es la detección de flanco de subida de la electrónica digital. |
| **Auto-repetición** | Mantener la cruz hacia abajo mueve el cursor una vez, espera 380 ms y después sigue moviendo cada 150 ms, como el teclado de un computador. |
| **Silenciar los controles** | Mientras el menú de inicio está, `controles.silenciar(true)` hace que al juego le llegue solo lo que aprieta el piloto (nada de la persona), pero el menú sigue leyendo lo que se aprieta. Como cortar la salida de un amplificador dejando el medidor conectado a la entrada. |
| **`navigator.webdriver`** | Una marca que el navegador pone en `true` cuando lo maneja un programa de pruebas (Playwright). La página la usa para no mostrar el menú de inicio en las pruebas automáticas (que esperan el juego directo), salvo que la dirección diga `?inicio=1`. |
| **Contenedor de referencia (para `position: fixed`)** | Un elemento "fijo" se mide normalmente contra la ventana. Pero si alguno de sus padres tiene `transform`/`translate` o `container-type`, se mide contra ese padre. Esto pasaba en el teléfono parado: los botones quedaban pegados al borde de la imagen y no al de la pantalla. |
| **Ensayo general (B5)** | Probar todo el camino de publicación en este PC antes de hacerlo de verdad: el sitio servido como GitHub Pages, el programa final, el Worker de verdad (con un token de prueba de un amigo), la latencia de R2, primera y segunda visita. |

### La pantalla negra al caer del mapa (§68)

| Término | Qué es y qué hace |
|---|---|
| **Transición (de rayas)** | El efecto con que el juego pasa de una imagen a otra: aquí, rayas horizontales negras que se van ensanchando hasta tapar todo (como una persiana que se cierra), un rato en negro, y las rayas que se abren. Mario Kart Wii la usa cuando Lakitu rescata a un kart que se cayó: mientras está negro, el juego lo mueve de vuelta a la pista sin que se vea el salto. Como apagar la luz del escenario para cambiar los muebles. |
| **Screencast (de las DevTools)** | Una función de Chrome que entrega cada imagen que de verdad llega a la pantalla (ya armada con la página encima), con su hora. Sirve para medir lo que **ve** la persona, no lo que el programa cree que dibujó. Como poner una cámara frente al monitor en vez de medir la señal en la placa. |
| **Brillo (luminancia)** | Cuánta luz tiene una imagen: el promedio, píxel por píxel, de 0,299·rojo + 0,587·verde + 0,114·azul (el ojo ve más el verde), de 0 (negro) a 255 (blanco). Bajo 3 es negro del todo. |

### El jugar.bat: la página de Juegos en esta PC (§69)

| Término | Qué es y qué hace |
|---|---|
| **Emulador de Firebase** | Un programa oficial de Google que imita, en la propia PC, los servicios de Firebase que usa el sitio: las cuentas (Authentication), la base de datos en tiempo real y el almacén de archivos (Storage), **con las mismas reglas de seguridad** del sitio. Como simular un circuito en SPICE antes de soldarlo: se comporta como el de verdad, pero nada sale de la PC, no se gasta nada y se puede borrar y empezar de cero. Necesita Java (la base y Storage están escritos en Java). |
| **Cuenta de mentira (del emulador)** | Un usuario que el emulador de cuentas acepta sin pasar por Google: aquí Piloto Uno, Dos y Tres y el Intruso, con correos `@paginita.test` (`.test` es un dominio reservado que no existe en internet). Al apretar «Iniciar sesión», en vez de la ventana de Google aparece la del emulador con la lista para elegir. |
| **Token sin firma y re-firmado** | Las credenciales (tokens) que entrega el emulador vienen **sin firma digital** (`alg: none`). El Worker de verdad exige la firma de Google, así que el arnés local (`worker-local.mjs --emulador`) las vuelve a firmar con su clave de prueba, sin cambiar lo de adentro (quién es, su correo, cuándo vence), y el Worker hace su revisión de siempre: firma, proyecto, vencimiento y que el correo esté en la lista de amigos. Como un documento que llega sin timbre y la notaría de prueba le pone el suyo para que el revisor lo acepte; el Worker publicado no cambia: allá un token sin firma se rechaza. |
| **Perfil de Chrome (`--user-data-dir`)** | La carpeta donde Chrome guarda la sesión, las cookies, la caché y el almacenamiento de las páginas. Con una carpeta distinta por ventana, cada ventana es "otro PC": otra cuenta, otra caché, otras partidas guardadas. Como tener dos instrumentos iguales, cada uno con su propia memoria interna. |
| **Contexto de navegador (Playwright)** | Lo mismo que un perfil, pero para las pruebas automáticas: un Chrome "recién instalado" con su sesión propia. La prueba usa tres a la vez (Piloto Uno, Piloto Dos e Intruso) para simular tres PC. |
| **Filtro local del catálogo** | Una lista (`window.__JG_SOLO = ["mkw"]`) que el servidor local pone en la página de Juegos: con ella el catálogo muestra solo esos juegos. El código del sitio la ignora si la página no está en 127.0.0.1 o localhost, así que en el sitio publicado no hace nada aunque alguien la escriba (hay una prueba para eso). |
| **Exportar al cerrar (`--export-on-exit`)** | Los emuladores guardan en disco lo que tienen (cuentas, base, archivos) cuando se apagan con Ctrl+C, y el próximo arranque lo vuelve a cargar (`--import`). Así las partidas, salas y VR de mentira siguen ahí al día siguiente. Como la memoria no volátil de un equipo: se escribe al apagarlo. |
| **Ruta relativa** | Una dirección escrita "desde donde estoy", como `./banco/comun.js` ("la carpeta banco que está al lado de esta página"). Si la página se cambia de carpeta, la misma ruta apunta a otro lugar. Como dar indicaciones "dos cuadras a la derecha": sirven solo si se parte del mismo punto. Así se escondía el error que encontró el ensayo (ver §69). |
| **Artifact (de claude.ai)** | Una página que claude.ai guarda y muestra dentro de su propio sitio, en una caja de seguridad. En BT3 se probó la sala abriendo un artifact en 3 pestañas. Para Mario Kart no sirve (ver §69). |
| **Private Network Access** | Una regla de seguridad de Chrome: una página de internet no puede pedirle cosas a la red de la casa ni a la propia PC (127.0.0.1) sin permiso especial. Protege de que una página cualquiera "toque" el router o los programas locales. Por eso un artifact no puede hablar con el juego, los emuladores ni el Worker de esta PC. |

### El retraso que se adapta a la red y el banco de todas las pruebas (§70)

| Término | Qué es y qué hace |
|---|---|
| **Ida y vuelta (RTT)** | Lo que tarda un mensaje en ir a la otra consola y volver la respuesta (en inglés *round-trip time*). La **ida** sola es más o menos la mitad. Se mide con un ping. Como medir el largo de un cable con un reflectómetro (TDR): se manda un pulso, se mide cuándo vuelve el eco y la mitad es lo que tarda en llegar al otro extremo. |
| **Ping** | Un mensaje chiquito que lleva la hora en que salió; la otra consola lo devuelve tal cual (el "pong") y al llegar de vuelta se resta: hora de ahora − hora del ping = ida y vuelta. Aquí va cada medio segundo a cada jugador, todo el rato (en los menús y en la carrera), y lleva un número para saber si alguno se perdió. |
| **Cámara lenta (en la carrera sincronizada)** | Si los botones de los demás tardan en llegar más que el retraso (3 cuadros = 50 ms), cada consola espera en cada cuadro a que lleguen: el juego no puede avanzar sin ellos. Con 70 ms de ida y retraso 3, la carrera espera ~10 ms por cuadro: va a ~40 cuadros por segundo en vez de 60. Como una cadena de montaje que avanza al ritmo de la pieza que llega más tarde. |
| **Retraso adaptable** | En vez de 3 cuadros siempre, antes de cada carrera se elige cuántos (3 a 8, o sea 50 a 133 ms) según lo que tarda la red de verdad: en esta PC o en la misma ciudad, 3; con 70 ms de ida, 6. Más retraso = los botones se sienten un poco más tarde, pero la carrera va a 60 cuadros por segundo. Como el *buffer* de un reproductor de video: llena un poco antes de empezar para no cortarse. |
| **Decisor (del retraso)** | El único jugador que elige el número: el primer humano de la sala que sigue jugando. Uno solo, porque si dos consolas usaran números distintos la carrera se desincronizaría (los primeros cuadros son "sin botones" hasta el retraso). Lo anuncia una vez, al empezar la carrera, y quien lo recibe se lo pasa a los demás por si a alguno no le llegó directo. Como el que da la partida en una carrera: uno solo dispara. |
| **Piso, tirón y percentil 90** | De las últimas 16 medidas (8 s): el **piso** es la más rápida (lo que tarda la red cuando nadie se traba). Las que pasan del piso + 100 ms son **tirones**: la otra pestaña estaba ocupada (cargando la pista) y contestó tarde, no es culpa de la red; no cuentan. De las que quedan se toma el **percentil 90**: la medida que deja 9 de cada 10 por debajo (así entra lo que varía la red). Como medir el ruido de una señal sin contar los picos de cuando arranca el motor. |
| **Pérdida de paquetes** | Por el canal rápido ("udp") un mensaje puede no llegar nunca. Los botones van repetidos en los 16 paquetes siguientes, así que uno perdido llega en el próximo, un cuadro (16,7 ms) más tarde. Si en los últimos 8 s se perdió alguna respuesta de ping, el retraso cubre también ese cuadro de más. |
| **Red mala de mentira (`?redMala=70,10,5`)** | Un interruptor de prueba que demora todo lo que llega 70 ms ± 10 ms y bota el 5 % de lo que viaja por "udp" (lo que viaja por el canal confiable llega siempre y en orden, solo que tarde). Sirve para probar con el juego, en esta PC, una red como la de un jugador lejos. Como un atenuador y una línea de retardo en el banco de pruebas. |
| **`?retraso=fijo`** | Apaga el retraso adaptable (siempre 3, como antes) para comparar. |
| **`correr-todo` (planilla de pruebas)** | `herramientas/correr-todo.mjs`: corre todas las pruebas del proyecto en fila, guarda lo que escribió cada una y termina con una tabla (prueba, bien, mal, tiempo). Como el banco de prueba de fin de línea de una fábrica: la misma rutina para cada placa y la planilla al final. |
| **Falla intermitente** | Una que sale 1 de cada tantas veces (como el cuelgue al empezar la carrera, C4). Para cazarla se repite la misma prueba muchas veces guardando cada corrida aparte (`--repetir N`). Como un falso contacto: hay que golpear la placa muchas veces y registrar cada vez. |
| **Byte de control (la trampa del `\b`)** | Un "carácter" que no es una letra sino una orden para la pantalla: el 8 es "retroceso" (*backspace*). En Python, escribir `\b` dentro de un texto normal lo convierte en ese byte; en una expresión regular de JavaScript `\b` significa "borde de palabra". Al copiar código de un lenguaje a otro con un script, el `\b` se transformó en el byte 8 y la regla dejó de funcionar sin dar error. |
| **Aviso de sala lenta** | Un cartel que aparece sobre el juego en la carrera sincronizada cuando la sala va lenta por alguien: «espera al jugador 2 de la sala (su PC o su conexión no dan abasto)» en las demás y «Tu PC no alcanza 60 cuadros por segundo» en la lenta. Cada 3 s la página compara cuántos cuadros avanzó y cuánto esperó, y a quién. |
| **Dos ratos seguidos (histéresis)** | El aviso sale solo si dos medidas seguidas (6 s) salen mal: un tirón suelto (la pista bajando al empezar la carrera) no avisa. Como el retardo de un relé térmico, que no salta con el pico de corriente del arranque del motor pero sí con una sobrecarga que dura. |

### Abrir directo por código y Retro WFC por la página (§71)

| Término | Qué es y qué hace |
|---|---|
| **Sección (del juego)** | Cada "modo de pantalla" grande del juego: el título, el menú de un jugador, el modo en línea, cada tipo de carrera. Tiene su número (0x48 = un jugador, 0x55 = en línea, 0x68 = carrera en línea). Al cambiar de sección el juego descarga la anterior y carga la nueva (con su fundido a negro). Como los modos de un instrumento de medición: voltímetro, amperímetro, osciloscopio; cada uno con su pantalla y sus perillas. |
| **Página (del juego)** | Una pantalla dentro de una sección: el menú, el cartel encima, el elegir personaje. Se apilan en capas (la de arriba es la que se ve y la que recibe los botones). Tienen número (0x69 = menú de un jugador, 0x8B = menú de Retro WFC, 0x4D = un cartel). |
| **SectionMgr** | El objeto del juego que manda en las secciones (vive en la dirección 0x809C1E38). Dos de sus funciones son las que usa el propio juego para cambiar de sección: **SetNextSection** ("la que sigue es esta") y **RequestSceneChange** ("cámbiala ya"). Como el selector rotativo del instrumento. |
| **Abrir directo** | Pedirle al juego la sección que se quiere **llamando a esas mismas funciones suyas**, en vez de recorrer los menús apretando botones. Lo pidió el dueño ("abrir directo es literalmente abrir directo"). Como marcar el número de un canal en el control remoto en vez de apretar "siguiente" diez veces. |
| **Gancho (envolver una función)** | Cambiar una función del juego por una nuestra que hace algo antes y después llama a la original. Aquí se envuelve el **Update** del SectionMgr (corre una vez por cuadro): si la página pidió un salto, lo hace ahí, en el hilo del juego y en un momento seguro. Como un relé de enclavamiento puesto en serie con un circuito existente: no cambia el circuito, solo agrega una condición. |
| **Versión de Retro Rewind de una función (`rr_overlay_X`)** | Retro Rewind cambia algunas funciones del juego (parches de Pulsar). En el C++ traducido quedan las dos: la del juego (`func_X`) y la de RR (`rr_overlay_X`), y las llamadas van a la de RR. Por eso el gancho se pone en `rr_overlay_8063550C` (puesto en la del juego, nunca se llamaba). Como un circuito con un puente soldado encima: hay que medir en el puente, no en la pista original. |
| **Licencia** | El perfil del juego (hasta 4 por partida): su Mii, sus récords, su VR. Al empezar, la pantalla de licencias elige una; sin licencia el juego no sabe quién juega. Abrir directo hace lo mismo que esa pantalla al elegir la 1 (la función del juego 0x805EB7A0, leída en el C++ traducido), y si la partida es nueva la **crea** con un Mii, como «Crear licencia». |
| **CreateID (del Mii)** | Los 8 bytes que identifican a un Mii: 4 del Mii y 4 de la consola que lo creó. La licencia guarda el CreateID de su Mii; el juego busca ese Mii en la base de Mii de la Wii (RFL_DB.dat). Como el número de serie de una pieza. |
| **Registrar el mando** | En el título, el juego anota qué mando apretó A: ese queda como el del jugador 1 (SectionPad). Si se salta el título, hay que anotarlo nosotros: si no, la pantalla nueva dice «se interrumpió la comunicación con el mando, aprieta A». Se hace como el juego: el "portador" del jugador 1 toma el mando de GameCube del puerto 1, y la casilla queda conectada. Como asignar un canal del osciloscopio a una sonda antes de medir. |
| **Acción de un botón, llamada directo** | Cada botón del juego tiene una función que corre cuando alguien lo aprieta (por ejemplo "Mundial" en el menú de Retro WFC). Llamarla nosotros es "apretarlo" sin pasar por el mando ni por la pantalla: se ejecuta exactamente lo mismo. Solo las funciones de una lista corta, y solo cuando la página está **activa** (terminó de entrar). |
| **Estado de una página (activa = 4)** | Cada página pasa por estados: entrando (con su animación), activa (esperando a la persona), saliendo. Si se llama la acción de un botón mientras todavía entra, la página al activarse deja todo como al principio y la acción se pierde. Como apretar un botón de un equipo mientras todavía hace su autoprueba al encender. |
| **Cartel (Click::OnClick)** | Las páginas que solo muestran un texto y se cierran con A (por ejemplo «Welcome to Retro Wi-Fi Connection!»). Su acción de cerrar es una función del juego que también se llama directo. |
| **Bucle de juego de Retro WFC** | Lo que se hace una vez adentro del modo en línea: buscar sala → elegir personaje y kart → votar pista (con reloj) → ruleta → carrera → puntos y VR → otra votación, sin fin. Está investigado en `docs/en-linea.md`. |

### Los tres modos de la sala sobre Retro WFC (§72)

| Término | Qué es y qué hace |
|---|---|
| **Modo de la sala (estilo)** | Lo que elige quien abre la sala de Mario Kart en el sitio: **Retro WFC** (el modo en línea del juego tal cual, sin fin), **Modo copa** (N carreras con puntos y una tabla al final) o **Modo playlist** (una cola de pistas sorteada). Se guarda como `estilo` porque las reglas de Firebase ya usan `modo` para otros juegos. Como el selector de función de un multímetro: el mismo aparato (el modo en línea del juego), distinta forma de usarlo. **Desde §73 solo copa y playlist**: el dueño pidió no pasar por Retro WFC. |
| **Paquete SELECT** | El "acta" que se mandan las consolas mientras eligen: el personaje, el kart y el voto de cada uno, y lo que decidió el anfitrión (la pista ganadora, la cilindrada, de quién era el voto que salió). Lo arma `SELECTHandler` del juego, con campos agregados por Retro Rewind (Pulsar: `PulSELECT`). Como la planilla que firma cada integrante de un jurado y que el presidente completa con el veredicto. |
| **DecideTrack / DecideCC** | Las dos funciones de Retro Rewind con que el anfitrión decide: la pista (sortea uno de los votos, evitando repetir) y la cilindrada (10 % 100cc, 65 % 150cc, 25 % espejo). En el C++ traducido se llaman `rr_kamek_81864290` y `rr_kamek_81864878` (están en el código de Retro Rewind, que vive en 0x818…). |
| **SetPlayerData (el voto)** | La función del juego (0x80660750, con un parche de Retro Rewind) que anota en el paquete SELECT el personaje, el kart y el **voto** de pista de una persona cuando lo confirma. En la playlist el voto se cambia ahí por la pista de la cola: así todas las tarjetas de la ruleta muestran la misma pista. |
| **Id de pista de Pulsar** | El número con que Retro Rewind nombra cada pista: 0x100 + 4·copa + fila (la copa 13, fila 2 → 0x136); las 32 de Nintendo también tienen números bajos (0x00-0x1F). La página siempre habla con «copa.fila» (`13.2`). |
| **Reloj de elegir** | La cuenta regresiva de arriba a la derecha mientras se elige personaje, kart y pista en línea. Arranca con un número guardado en la memoria del juego (30.0 en 0x80899EF4, dentro de StaticR.rel); la página lo cambia por 45.0 antes de que se use. Como cambiar la resistencia de un temporizador RC: el circuito es el mismo, solo dura más. |
| **Constante en memoria (rodata)** | Los números fijos que usa un programa (30.0, 10.0…) no van dentro de la instrucción: están guardados en una zona de datos de solo lectura y la instrucción los va a buscar (`lfs`). Si se cambia ese número en la memoria, cambia lo que hace el programa sin tocar su código. Hay que comprobar antes quién más lee ese número (aquí, solo `SELECTStageMgr::OnResume`, en sus dos versiones). |
| **Etapa de la carrera (Raceinfo +0x28)** | En qué parte va la carrera: 0 presentación, 1 cuenta regresiva, 2 carrera, 3 terminando (un cuadro), 4 terminada para todos. La copa cuenta una carrera cuando ve el 4 dentro de una sección de carrera en línea (0x68-0x77). |
| **Puntos (score)** | Lo que el juego anota a cada jugador al terminar una carrera (15 al primero, 12 al segundo, 10…): Racedata guarda los de antes (+0xD8) y los de ahora (+0xDA) de cada jugador; la diferencia es lo que dio esa carrera. |
| **Tabla final** | La lista ordenada de pilotos con sus puntos sumados al terminar la copa o la playlist. La muestra el marco del juego (un cuadro nuestro encima de la imagen) y el marco del anfitrión se la manda al sitio, que la guarda con la vuelta al vestíbulo («Última copa»). El sitio la limpia (máximo 12 filas, nombres de 20 letras, puntos enteros) porque viene de una página. |
| **Cola sorteada (playlist)** | La lista de pistas de la playlist: cada navegador la calcula igual a partir del nombre de la sala y el número de tanda (el mismo "dado" con la misma semilla), así nadie tiene que escribirla en Firebase. Como dos relojes de cuarzo iguales: no se hablan y marcan lo mismo. |
| **Sección de desconexión (0x78 / 0x79)** | La pantalla a la que el juego salta cuando pierde la conexión en línea («se interrumpió la comunicación», con un número de error). |
| **Control de inactividad (desconexión por no tocar nada)** | Una regla del Mario Kart Wii original para las carreras en línea: si un jugador pasa **30 s sin tocar ningún botón** (1800 cuadros), el juego lo da por ausente y lo desconecta («You were disconnected from the other players»), para que una consola abandonada no frene a todos. Lo hace `GMDataOnlineVS` (0x8053F184) preguntándole al administrador de mandos cuántos cuadros lleva quieto ese mando. Retro Rewind agrega otro igual, por velocidad (si el kart casi no avanza). Como el "hombre muerto" de un tren: si el maquinista no toca el pedal en un rato, el tren se frena solo. |
| **DisconnectMgr (página 0x88)** | La página invisible que vigila la conexión en cada cuadro de las pantallas en línea. Si ve una marca de corte (la de inactividad, un error de red, demasiado tiempo en un menú), pide la desconexión (`Section::ScheduleDisconnection`, 0x80623054) y salta a la sección del aviso (0x79). Como un interruptor diferencial: mide todo el tiempo y corta solo cuando ve la falla. |
| **Terminar la carrera por código (para las pruebas)** | En las pruebas nadie maneja: el kart no llega a la meta y a los 30 s el control de inactividad corta. La prueba le pide al juego (`window.mkwTerminarCarrera` → `mkw_modos_terminar` en `modos_nativo.cpp`) que en el cuadro siguiente llame a **EndLap** (0x805349B8, la función que corre al cruzar la meta) hasta pasar la última vuelta: el juego hace el resto como si el piloto hubiera llegado (tiempo, puesto, aviso a las otras consolas, puntos). Como apretar el botón de prueba de una alarma: se dispara el mismo circuito que con humo de verdad. |
| **Sala Mundial / Regional (y la región de Retro Rewind)** | Las dos formas de buscar rivales del juego: **Mundial** (cualquiera del mundo) y **Regional** (solo los de la misma región). Retro Rewind usa la Regional con un número de región propio para separar sus salas: 0x0A = las retro, 0x14 = pistas personalizadas, 0x15 = las de Nintendo, 0x0C = 200cc, 0x0B = OTT, 0x0D = lluvia de objetos. En una sala Mundial Pulsar deja solo las 32 pistas de Nintendo. El Retro WFC de RR es «Main modes» = Regional + VS (región 0x0A). Como las frecuencias de radio: el mismo equipo, pero cada canal junta a gente distinta. |
| **Pista válida (`IsValidTrack`)** | La regla de Pulsar para saber si un número de pista existe en la sala actual: hasta 0x29 siempre (las de Nintendo y las de batalla); de 0x100 en adelante, solo si la sala tiene las pistas de RR cargadas. Un voto de una pista que no vale se toma como «sin votar». |
| **Ficha de la carrera** | Nuestra lista de lo que lleva una carrera (pista, cilindrada, espejo, nivel de la CPU, objetos, número de carrera, semilla y, por cada uno de los 12 puestos, si es persona o CPU, su personaje, su vehículo y su mando). La página la arma (`directo.mjs`, `armarFicha`) y el juego la copia a Racedata justo antes de saltar a la carrera (`directo_nativo.cpp`). Como la hoja de ajustes que se carga en un equipo antes de encenderlo: todas las consolas cargan la misma. |
| **Arrancar directo en la sección (sección de arranque)** | Al encender, el juego elige la primera pantalla con un número guardado en SectionMgr (+0x4, `bootSectionId`: normalmente 0x3F, el título). Si lo cambiamos justo después de que el juego lo pone (envolviendo `SectionMgr::Init`), el juego arranca directamente en la pantalla de elegir personaje o en la carrera: el título y las licencias ni se crean. Como cambiar el vector de reinicio de un microcontrolador para que salte directo a la rutina que uno quiere. |
| **Jugador local de verdad (en todas las consolas)** | En la sala nueva, cada humano de la sala figura en TODAS las consolas como jugador "local" del juego (tipo 0, el que maneja un mando conectado a la Wii), cada uno con su puerto de mando (0 a 3). Así la CPU compite contra ellos como en un Grand Prix y cada kart lee sus botones del puerto que le toca; la red (lockstep) pone en cada puerto lo que tocó esa persona. Por eso caben 4: la Wii tiene 4 puertos de mando. |
| **Pantalla propia (una sola pantalla)** | Con 2 jugadores locales el juego dibujaría la pantalla partida en dos. Cada consola deja UNA pantalla, la de su persona, y UN jugador local (el suyo): "cuántas pantallas" (+0x5) y "cuántos locales" (+0x6) del escenario quedan en 1 y la tabla de pantallas (+0xB48+0x1C) pone primero a su piloto. El otro humano sigue siendo persona (tipo 0). Se escribe al terminar la versión de Retro Rewind de `RacedataScenario::Init`, que si no lo vuelve a pisar. |
| **Conteos del escenario (jugadores, pantallas, locales)** | Tres números de Racedata que el juego calcula al preparar la carrera (+0x4 cuántos corren, +0x5 cuántas pantallas, +0x6 cuántos juegan en esta consola). El HUD arma sus controles por cada jugador local y la escena arma una vista por pantalla: si no cuadran (2 locales y 1 pantalla) el HUD busca una cámara que no existe y el juego se cae. |
| **Detector de pantalla partida (`foto-pantalla.mjs`)** | Mira la foto del juego: compara cada fila de píxeles con la de arriba. Dentro de una vista las filas se parecen; en la costura entre dos vistas cambian de golpe. Un pico en el medio, mucho mayor que el salto típico = partida. Como encontrar un escalón en una señal por el pico de su derivada. |
| **Mando desconectado (`GetFirstDeactivatedPad`)** | La función del juego (0x8061B9BC) que revisa en cada cuadro si a algún jugador local se le desconectó el mando; si encuentra uno, pausa con «Se interrumpió la comunicación con el mando». En la sala, los mandos de los otros humanos no están enchufados en esta consola (sus botones llegan por la red), así que la envolvemos para que diga "ninguno desconectado". |
| **Árbitro de la sala (`sala-carrera.mjs`)** | El que lleva la sala de un paso al siguiente (elegir la copa → elegir personajes → carrera 1 → resultados → carrera 2 …). Manda el anfitrión: él guarda el estado de verdad y cada segundo se lo reparte entero a todos; los demás solo le avisan lo suyo (qué eligieron, que su carrera terminó). Como un tablero de control con un solo operador. |
| **Cambio de anfitrión** | Si quien manda se va a mitad de la copa, la sala del sitio nombra a otro y se lo avisa al marco del juego de cada uno; el nuevo sigue desde su última copia del estado, sin recargar el juego. |
| **Recursión sin fin (desbordar la pila)** | Una función que, sin querer, termina llamándose a sí misma una y otra vez: cada llamada apila su "a dónde volver" y la pila se llena («Maximum call stack size exceeded»). Aquí: la anfitriona avisaba lo que eligió → eso cambiaba el estado → el cambio volvía a avisar lo elegido → … Como un lazo de realimentación positiva que satura. |
| **Idempotente** | Que hacer algo dos veces dé lo mismo que hacerlo una (como apretar "encender" en un equipo ya encendido). Avisar «elegí Mario» dos veces ya no cambia nada la segunda vez: así se cortó el círculo. |
| **Interbloqueo (deadlock)** | Dos partes esperándose mutuamente para siempre. Aquí: la anfitriona saltó a la carrera 2 y dejó de mandar botones de la 1; la otra consola, un cuadro atrás, esperaba esos botones con el juego detenido, y con el juego detenido no podía saltar a la 2. Como dos relés que se mantienen abiertos uno al otro. |
| **Salida de la carrera (cuadros sin esperar)** | El arreglo del interbloqueo: cuando la página pasa a la carrera siguiente, el lockstep suelta la espera y los últimos cuadros que el juego corra de la carrera vieja van sin esperar a nadie y con todos quietos (ya no importan: nadie más los corre). La carrera nueva empieza cuando el contador de cuadros vuelve a cero. |
| **Largada pareja** | Que todos empiecen la carrera en el mismo instante aunque uno cargue la pista antes. Con el lockstep sale solo: ninguna consola avanza un cuadro sin los botones de todas, así que la que llegó primero queda quieta en el primer cuadro (con el aviso «Esperando a que el jugador 2 termine de cargar la pista…») hasta que llega la última. |
| **Bundle (`juegos-app.js`)** | El archivo único que la página de Juegos carga de verdad: todos los `.js` de `colabtex/src` pegados y comprimidos por `esbuild`. Cambiar `src/` no cambia lo que ve el navegador hasta que se vuelve a armar el bundle. Como un plano corregido que no sirve mientras no se imprima la copia que usa el electricista en la obra. |
| **Cupo de la sala** | Cuántas personas caben en una sala del sitio. Se elige al crearla («Pilotos: 2, 3 o 4»); si no se elige, el sitio pone el mínimo (2). Como el número de enchufes de una zapatilla: si viene de 2, el tercero no tiene dónde conectarse aunque el juego admita 4. |

### El selector de pistas: la lista, la copa y las sugerencias (§74)

| Término | Qué es y qué hace |
|---|---|
| **Modo lista / modo copa / modo sugerir** | Las tres formas del selector de pistas de la página. **Lista**: se arma una lista de hasta 32 pistas (un clic agrega, otro quita); es la del un jugador «a tu gusto» y la del anfitrión en la playlist. **Copa**: se elige una de las copas del juego entera (sus 4 pistas). **Sugerir**: la de los demás en la playlist: un clic no agrega, le *propone* la pista al anfitrión. Como un tablero con tres llaves selectoras: el mismo panel, tres funciones. |
| **Preset (lista guardada)** | Una lista de pistas con nombre que queda guardada en el navegador para usarla otra vez («Retro de la noche»). Como las memorias de un sintonizador: se graba una vez y se recupera con un botón. |
| **Borrador del navegador (`localStorage`)** | Un cajoncito de memoria que cada página tiene en el navegador y que sobrevive a cerrar y recargar. La lista que uno está armando se guarda ahí en cada cambio: si se cierra el selector, al volver sigue igual. Como una memoria no volátil (EEPROM) del equipo. |
| **Precargar (prefetch)** | Bajar algo antes de que se pida. Las fotos de las pistas vienen en paquetes (~1 MB cada 48 pistas); antes se bajaban al primer paso del mouse y la vista tardaba hasta 1,5 s. Ahora se bajan todas en fila apenas se abre el selector. Como precalentar el horno antes de meter la comida. |
| **Decodificar una imagen** | Pasar el archivo comprimido (WebP) a los píxeles que se dibujan. Tarda unos milisegundos; si se muestra antes de terminar, se ve a medias o parpadea. La vista ahora espera a que la imagen nueva esté decodificada y recién ahí la cambia. |
| **Espera antes de mostrar (debounce)** | Cuando el mouse barre varias pistas rápido, mostrar cada una sería trabajo tirado: solo se muestra la que queda debajo 60 ms (o 250 ms si ya hay una copa marcada). Como el filtro antirrebote de un pulsador: se ignoran los cambios rápidos y vale el estado que se mantiene. |
| **WebP animado (el videíto)** | La presentación de cada pista (la cámara que vuela sobre ella al empezar la carrera), guardada como una imagen animada de 288×162. Vienen de a una copa por paquete; la página guarda las de las últimas 12 copas y suelta las más viejas. |
| **Minimapa (el plano en la esquina)** | El plano de la pista visto desde arriba, puesto chico en una esquina del video como en la carrera; al pasar el mouse se agranda al doble para leerlo. |
| **Fundido (crossfade)** | Cambiar de una foto a otra bajando una mientras sube la otra (140 ms), en vez de cortar de golpe. Hay dos capas de foto apiladas: la nueva se carga en la de atrás y, ya lista, pasa adelante. |
| **Marcar y confirmar** | En el modo copa un clic ya no elige: **marca** la copa (anillo amarillo) y el botón «Jugar la Copa N» (o Enter, o doble clic) la **confirma**. En la sala un clic suelto elegía la copa de todos sin querer. Como un interruptor de seguridad de dos tiempos: armar y después disparar. |
| **Hoja inferior (bottom sheet)** | En pantallas angostas el costado (la lista o la vista de la copa) es un panel pegado abajo que se pliega (solo su cabeza y el botón) o se despliega. La grilla deja libre ese alto al final, para que la última copa nunca quede tapada. |
| **`ResizeObserver`** | Un aviso del navegador cada vez que un elemento cambia de tamaño. Con él la página mide el alto de la hoja inferior y de la cabecera y deja ese espacio libre. Como un sensor de posición que realimenta a dónde va cada cosa. |
| **Menos movimiento / ahorro de datos** | Dos preferencias del sistema (`prefers-reduced-motion`, `Save-Data`). Si están puestas: sin videítos, sin avance solo y sin fundidos. |
| **Crítico de diseño** | Un agente aparte (otro Claude) al que se le dan las fotos de la pantalla y el código, con la consigna de criticar sin piedad y devolver un plan concreto (medidas, colores, comportamiento). Se usó dos veces: para la lista persistente y para el modo copa. Como pedirle a otro ingeniero que revise el plano antes de fabricar. |
| **Sugerencia (playlist de la sala)** | Una pista que un piloto le propone al anfitrión. Queda **pendiente** hasta que él la **acepta** (entra al final de la lista) o la **rechaza**. Hasta 8 pendientes por persona; no se sugiere una que ya está o que ya espera. Todo viaja dentro del estado de la sala, así que si el anfitrión se va, el nuevo ya tiene la lista y las sugerencias (`playlist-sala.mjs`). Como un buzón de sugerencias con un encargado. |
| **Panel de la playlist (entre carreras)** | Mientras se ven los resultados de una carrera de la playlist, un recuadro al costado con las pistas que vienen («sigue» la próxima), cuántas van corridas y un botón: «+ Agregar pistas» para el anfitrión, «Sugerir pista» para los demás. Se va solo cuando arranca la carrera siguiente. |
| **Pausa de la sala** | Cuando el anfitrión aprieta «+ Agregar pistas», el árbitro anota hasta cuándo esperar (60 s como máximo) y no pasa a la carrera siguiente aunque se acaben los resultados; al cerrar el selector quedan 3 s más y sigue. Como el botón de "hold" de un temporizador: congela la cuenta sin reiniciarla. |
| **Oscilador de WebAudio (los sonidos de la lista)** | Los sonidos de agregar, quitar, «llena» y «llegó una sugerencia» no son del juego: la página los fabrica con osciladores (un generador de onda de la frecuencia que se pida, 0,07–0,12 s) y una envolvente de volumen. Usan la salida de sonido del juego, así respetan el volumen y el silencio de la página. Como un generador de funciones con una compuerta. |

### Volver tras recargar, el fin de la carrera y los puntos (§75)

| Término | Qué es y qué hace |
|---|---|
| **Latido de la sala (`{t:'aqui'}`)** | Un mensajito que cada página manda a todas las demás cada segundo: «sigo aquí, tengo el estado número N, me salto la carrera K». Con eso la anfitriona sabe quién está y quién no. Como el pulso de un relé "watchdog": mientras llega, el equipo está vivo; si deja de llegar un rato, se lo da por caído. |
| **Plantel de la carrera (`fuera`)** | La lista de quiénes NO corren una carrera, que la anfitriona escribe en el estado al empezarla (los que no dieron latido en los últimos 10 s). Todas las consolas la usan igual: esos humanos van "sin nadie" desde el primer cuadro y los demás corren, aunque se hubieran cortado en la anterior. Como la lista de equipos conectados que el operador anota antes de energizar una barra: todos los tableros arrancan con la misma lista. |
| **Saltarse la carrera (`saltar`)** | Lo que hace la página recién recargada cuando la copa ya va por una carrera: no entra a esa (su consola no tiene los cuadros que ya pasaron), avisa en su latido «me salto la carrera K» y entra en la siguiente con su puesto y lo que había elegido. Con el aviso, la carrera de los demás la corta enseguida en vez de esperarla 30 s. |
| **Sala lista** | El momento en que la página sabe en qué va la sala y recién ahí empieza a mostrarla: los demás, con el primer reparto de la anfitriona; la anfitriona, cuando oyó a todos (de 2 a 8 s después de abrir). Antes de eso no muestra nada, para no tomar por buena una sala "nueva" que en realidad ya iba por la carrera 3. |
| **Copia del estado (`dame` / `copia`)** | Si la anfitriona recarga la página, su sala nueva está en el estado número 0, pero los latidos de los demás traen números más altos: les pide la copia, la adopta y sigue desde ahí con un número más alto que todos. Como reponer la configuración de un PLC reemplazado desde el respaldo que tiene otro equipo de la red. |
| **Acción en un cuadro (`enCuadro`)** | Algo que tiene que pasar en el MISMO cuadro de la carrera sincronizada en todas las consolas (por ejemplo, en la prueba, "los humanos cruzan la meta en el cuadro 1555"). La carrera sincronizada lo ejecuta al procesar ese cuadro. Como un disparo sincronizado por la misma señal de reloj en todos los equipos. |
| **Tiempo límite de la carrera** | La regla del modo en línea del juego: cuando el reloj de la carrera pasa del límite (5:00 en el juego original; Retro Rewind guarda el suyo en 0x818759B0), a cada piloto que todavía no cruzó la meta le termina la carrera con un tiempo estimado por lo que avanzó. Así una carrera no queda esperando para siempre a alguien que se quedó quieto. Como el temporizador de un horno: aunque el pan no esté dorado, a la hora se apaga. |
| **Escenario de los menús y de la carrera (puntos)** | Racedata guarda dos "fichas" de la carrera: la de los menús (+0xC10) y la de la carrera en curso (+0x20, una copia que se hace al empezarla). Los puntos de cada carrera se suman en la de los menús (`UpdatePoints`); la de la carrera se queda con los de antes. Por eso la tabla de la copa se lee de la de los menús. El juego los suma recién cuando la pantalla de resultados llena su tabla; en la sala los sumamos nosotros, una sola vez, en el primer cuadro con la carrera terminada (§75). Como un medidor de energía que solo se lee al cerrar el período: si nadie va a leerlo, el período no se factura; aquí lo "cerramos" siempre en el mismo instante. |
| **Puntos de antes y total (+0xD8, +0xDA)** | Cada jugador de Racedata guarda dos números: los puntos que tenía **antes** de esta carrera (+0xD8) y el **total** (+0xDA). Al terminar la carrera el juego hace total = de antes + los de esta. El "de antes" lo pone el menú de la carrera siguiente; como la sala abre cada carrera directo, lo ponemos nosotros al escribir la ficha. Como un medidor con lectura anterior y lectura actual: el consumo se calcula contra la anterior, y si nadie la anota, contra cero. |
| **Tabla de puntos de la sala (`puntos`)** | Los 12 puntos que lleva la copa, guardados en el estado de la sala: cada página los manda al terminar cada carrera con desde qué carrera corrió, y la anfitriona se queda con la de quien corrió desde más atrás. Quien recargó la usa para partir la carrera siguiente con los mismos puntos que los demás (su consola no tiene los de las carreras que se saltó). |

### La música bajo el menú JloKart, que tardaba en sonar (§76)

| Término | Qué es y qué hace |
|---|---|
| **Pipeline (de la GPU)** | La "receta" armada para dibujar una clase de cosa (con qué sombreador, qué mezcla de colores, qué formato). El navegador tiene que **compilarla** (traducirla al idioma de la tarjeta de video) antes del primer uso, y eso tarda: de 2 a 50 ms cada una. Como armar el circuito de una placa antes de energizarla. |
| **Precalentado** | Compilar de antemano los ~700 pipelines que el juego usó alguna vez (la lista va con el `.wasm`), para que en la carrera no haya tirones la primera vez que aparece algo. Como precalentar el horno. |
| **Precalentado postergado (`MKW_PRECALENTAR=tarde`)** | En vez de pedir los ~700 al arrancar, se piden recién cuando el juego llegó a su primera pantalla (el título), de a 2 por cuadro y con 4 compilándose como mucho. Al arrancar, el "proceso de la GPU" del navegador quedaba ocupado varios segundos con la lista y el título (con su música) esperaba atrás. Es como no arrancar todos los motores de una fábrica a la vez: se escalonan para no hundir la tensión. |
| **Caché de shaders del navegador** | Chrome guarda en el disco los pipelines que ya compiló; la segunda vez los saca de ahí casi gratis. En la 1.ª visita no hay nada guardado, por eso el precalentado postergado solo se usa si **este navegador ya jugó antes** (marca `mkw.precalentado` en el navegador, 20 s después del título): compilar de cero mientras suena la música la trababa (cuadros de hasta 0,85 s y cortes). |
| **Semilla del arranque** | De la lista de bloques del disco que el juego lee siempre (`bloques.json`), los que lee antes de su título se piden todos juntos apenas abre la página (96 bloques en 31 pedidos), en vez de uno por uno cuando el juego los va pidiendo, cada uno esperando los 50 ms de la red. Como llenar el carro con toda la lista de compras en un viaje, no ir a la tienda por cada cosa. |
| **Carpeta en racha** | Si el juego lee seguidos dos archivos diminutos (≤ 8 KB) distintos de la misma carpeta, `disco.mjs` pide de una vez el resto de esa carpeta. Así los 64 fantasmas del Contrarreloj que lee el menú «Un jugador» llegan en 4 esperas en vez de 32. |
| **Corte (hueco) de sonido** | Un bloque de sonido en silencio entre dos que sonaban: el juego no alcanzó a llenar el búfer a tiempo. El medidor de `sonido.mjs` los cuenta; la prueba exige 0. |

### El reloj de los que faltan (§77)

| Término | Qué es y qué hace |
|---|---|
| **DNF (Did Not Finish, «no terminó»)** | La regla de las carreras en línea de Mario Kart 8: cuando el primero cruza la meta, los demás tienen 30 s; al vencer, la carrera de los que faltan se termina sola en el puesto en que van. En la sala la dispara el primer corredor que llega, humano o CPU (desde §78; en §77 era el primer humano), y el juego les da a los que faltan un tiempo estimado por lo que avanzaron. Como el tiempo de espera de un relé temporizado: desde que llega la señal del primero, corre el plazo y al vencer abre el circuito aunque los demás no hayan llegado. |

### El contador de los que faltan (§78)

| Término | Qué es y qué hace |
|---|---|
| **Glifo** | El dibujo de una letra o número en una fuente. La «A» es una letra; el dibujito de la «A» en tal fuente es su glifo. |
| **BRFNT (fuente de la Wii)** | El archivo de letras de los juegos de la Wii. Adentro: **FINF** (medidas de la fuente), **TGLP** (las hojas de glifos), **CWDH** (el ancho de cada glifo: espacio a la izquierda, ancho dibujado y cuánto avanza la «pluma») y **CMAP** (qué glifo es cada letra, por tramos, por tabla o por pares). Formato público (Tockdom). |
| **Hoja de glifos** | Una imagen grande con todos los glifos de la fuente en celdas iguales (por ejemplo 44×53 píxeles, 11 por fila, con 1 píxel de separación). Como una plancha de calcomanías: para escribir «30» se recortan la del 3 y la del 0 y se pegan una al lado de la otra. |
| **IA4** | Un formato de textura de la Wii: cada píxel es 1 byte con **4 bits de opacidad** (arriba) y **4 de intensidad** (abajo), guardado en baldosas de 8×4 píxeles. Las hojas de glifos de Mario Kart Wii van en IA4. |
| **Fuente de contorno** | Una fuente cuyos glifos traen el borde dibujado: la **intensidad** dice si el píxel es relleno (1) o borde (0) y la **opacidad**, si hay letra. El color NO está en la hoja: lo pone quien dibuja. Como un tablero de LEDs bicolor: la hoja dice «rojo, verde o apagado» y el color real lo pone la fuente de poder de cada color. |
| **Material (colores «negro» y «blanco»)** | En las pantallas 2D del juego, cada caja de texto tiene un material con dos colores: el «negro» pinta lo que en el glifo es intensidad 0 (el borde) y el «blanco» lo que es intensidad 1 (el relleno); en el medio, una mezcla. Lo hace la **TEV** (la etapa de mezcla de colores de la GPU de la Wii). En la cuenta de salida: borde (70,70,70) y relleno (255,137,137). |
| **Degradado de vértices** | El color que la caja de texto pone en sus esquinas de arriba y de abajo; la GPU lo reparte suavemente en el medio y lo multiplica por el color de la letra. En la cuenta de salida: amarillo #F2FF00 arriba y #FFE100 abajo. Relleno (255,137,137) × amarillo = el **naranja** #F28900; borde (70,70,70) × amarillo = el **oliva** #424600. |
| **BRLYT / BRLAN** | El **plano** de una pantalla 2D del juego (qué cajas hay, dónde, con qué fuente y material: `go.brlyt` es la cuenta «3, 2, 1, GO!») y su **animación** (`go_fade_in.brlan`: cómo cambian la escala, la opacidad y los colores cuadro a cuadro). Formatos públicos (Tockdom). |
| **Cuadro clave (keyframe)** | En una animación, los valores se anotan solo en algunos cuadros («en el cuadro 0 la escala es 90, en el 9 es 2») y el juego calcula los del medio con una curva. Como los puntos de una tabla de calibración: entre punto y punto se interpola. |
| **Escalado bilineal** | Agrandar una imagen calculando cada píxel nuevo como un promedio de los 4 vecinos de la original: queda suave (un poco borrosa), sin escalones. El juego agranda así sus glifos (los de la cuenta miden ~40 px y se ven de ~80); la página hace lo mismo y por eso se ven igual. |
| **Unidades de contenedor (`cqh`, `cqw`)** | Medidas del CSS relativas a la caja que las contiene: `11cqh` = el 11 % del alto de esa caja. El contador va en una caja del tamaño exacto de la imagen del juego, así que «11cqh» es el mismo tamaño que la cuenta de salida en cualquier pantalla. Como dar una medida en «por unidad» de la base y no en voltios. |
| **Halo (`drop-shadow`)** | Una sombra difusa y oscura alrededor del dibujo (no una caja): separa el número del fondo cuando atrás hay carteles o rejas de colores. Los números del HUD del juego tienen algo parecido (un borde y una sombra oscuros). |
| **Especificidad (CSS)** | Cuando dos reglas del CSS le dicen cosas distintas al mismo elemento, gana la más específica (la que nombra más cosas: «`.cuenta-dnf canvas`» le gana a «`.cuenta-dnf-letrero`»). Así el letrero quedaba a su tamaño natural en el teléfono. Como dos salidas manejando la misma línea: manda la de mayor prioridad, aunque uno haya querido la otra. |
| **Letra de reserva** | Si la fuente del juego no se puede leer (sin disco, o una prueba sin juego), el contador escribe con una letra del navegador, gruesa y con los mismos colores. Es el plan B: se ve parecido y nunca deja de contar. |
| **Agente crítico** | Otro Claude al que se le muestran fotos y se le pide un juicio frío con una lista de «pasa / no pasa» y arreglos con números. Lo pidió el dueño para el estilo del contador; hizo 3 rondas. |

### La cortina de Lakitu que no tapaba todo el alto (§79)

| Término | Qué es y qué hace |
|---|---|
| **Relación de aspecto** | El ancho dividido por el alto de una imagen. Mario Kart Wii en pantalla ancha es **16:9** (1,78: 16 de ancho por cada 9 de alto); una ventana casi cuadrada es ~1,1:1. Si una imagen se muestra con otra relación de aspecto que la suya, o se deforma (estirada) o le sobran franjas (barras). |
| **Tamaño interno del canvas y su recuadro** | El canvas (el "lienzo" donde dibuja el juego) tiene dos tamaños: los **píxeles que tiene adentro** (`canvas.width × canvas.height`, por ejemplo 854×480) y el **recuadro que ocupa en la página** (lo fija el CSS, por ejemplo 900×1100). El navegador agranda lo de adentro para llenar el recuadro. Como una foto: una cosa es su resolución y otra el tamaño del marco donde se cuelga. |
| **SDL3 siguiendo al recuadro** | SDL3 (la capa de ventana que usa aurora) escucha el aviso `resize` del navegador: cada vez que la ventana, o el marco del sitio, cambia de tamaño, le pone al canvas por dentro **el tamaño de su recuadro**. Así el juego "ve" una ventana de la forma del recuadro. Al cargar no pasa (el canvas nace en 854×480); pasa con el primer cambio de tamaño. |
| **Aspecto dinámico (de WiiCompiled)** | Lo que hace WiiCompiled cuando su ventana no es 16:9 (`dynamic_aspect.cpp`): le cambia al juego las medidas de sus "pantallas" (`EGG::Screen`) para que la escena 3D llene la ventana con su forma: más ancha si la ventana es ancha, más alta (la "expansión vertical") si es alta. Pero lo 2D del juego (el HUD, la cortina) sigue dibujándose en su hoja de 16:9, que queda en el medio. |
| **Capa 2D y escena 3D** | El juego dibuja dos cosas encima una de otra: la **escena 3D** (pista, karts, cielo), vista por una cámara, y la **capa 2D** (el reloj, las vueltas, el mapa, la cortina de rayas), dibujada sobre una "hoja" plana de tamaño fijo (608×456 unidades de la Wii). Estirar la cámara cambia la escena, no la hoja. Como un proyector y una transparencia de acetato encima: si se agranda la imagen proyectada, el acetato sigue del mismo tamaño. |
| **`force_16_9` (forzar 16:9)** | Una opción del `Config.toml` de WiiCompiled (`[video]`): la imagen del juego es siempre 16:9, tenga la forma que tenga la ventana; lo que sobra lo pinta aurora de negro dentro del canvas (barras). La página la escribe en `true` desde §79 (`?aspecto=libre` = el estirado de antes). |
| **Barras (letterbox / pillarbox)** | Las franjas negras que quedan cuando una imagen se muestra entera, sin deformarla, en un recuadro de otra forma: arriba y abajo (*letterbox*, ventana alta) o a los lados (*pillarbox*, ventana ancha). Como ver una película de cine en un televisor: el televisor no la estira, deja franjas. |
| **`scrollIntoView` («nearest»)** | Una orden del navegador: desplazar la página lo justo para que un elemento se vea entero; con `block: "nearest"`, si ya se ve no mueve nada. El sitio la usa con el marco del juego cuando aparece y cuando el juego avisa `{tipo:'mirame'}` (abrió un selector de la sala). Como el autoenfoque de una cámara que solo se mueve si el objeto salió del cuadro. |

### Que un jugador lento no frene a los demás (§80)

| Término | Qué es y qué hace |
|---|---|
| **Retraso de entrada (de cada jugador)** | Cuántos cuadros después de apretar un botón lo usa la carrera. Lo que toco en el cuadro 100 con retraso 4 vale para el cuadro 104: así mis botones tienen 4 cuadros (67 ms) para llegar a los demás antes de que los necesiten. Desde §80 cada uno tiene **el suyo** (de 2 a 12) y lo ajusta durante la carrera: quien tiene la conexión lenta usa uno más grande y su kart responde más tarde, pero los demás no lo esperan. Como el tiempo de anticipo de una orden de despacho: quien está más lejos manda su orden con más anticipo. |
| **Holgura** | Cuántos cuadros antes de necesitarlo llegó el botón de un jugador. Holgura 3 = llegó 3 cuadros antes; 0 = justo a tiempo; negativa = tarde (tuve que esperarlo, o iba relevado). Como el margen de fase de un lazo de control: cuánto le falta para volverse inestable. |
| **Rato (ventana) e informe** | Cada medio segundo, cada consola le cuenta a todas (mensaje 10), para cada jugador, la peor holgura del rato, cuánto lo esperó y cuántos ratos seguidos le fue mal con él. Es la medición que cierra el lazo del retraso: cada jugador ajusta el suyo con lo que miden los demás. |
| **Rato dudoso** | Un rato en que yo esperé a alguien, o me estaba poniendo al día. Ahí la holgura que medí no dice nada de los demás, porque yo estaba quieto o corriendo de más. Solo cuentan las esperas. Como una medida tomada mientras el instrumento estaba saturado: se descarta. |
| **Mayoría (de quién es la culpa)** | Que el jugador m tiene un problema se cree solo si lo ve **más de la mitad** de los que informan de él. Si a uno solo le llega todo tarde, el problema es la conexión de ese uno: recibe tarde de todos. Como votar entre tres sensores redundantes: si uno solo marca falla, el sensor malo es ese. |
| **Voto descontado («pasa hambre»)** | Lo que dice un jugador al que la mayoría ve mal, o justo, o que va relevado, o que ve mal a TODOS los demás, no cuenta. Si su conexión es la mala, ve tarde a todo el mundo, y su voto haría culpable a cualquiera. |
| **Heredado** | Si m se atrasó porque esperaba a otro que la mayoría ve mal, sus botones salieron tarde por eso: no es culpa de m (no sube su retraso ni se lo releva). Como una caída de tensión aguas abajo de una falla: el interruptor que hay que abrir es el de la falla, no el de cada carga. |
| **Autoridad** | Un jugador elegido igual en todas las consolas (el primero de la sala que sigue en la carrera) que, en su propio paquete de cada cuadro, puede llevar los botones de otros. Si la autoridad es la lenta (todos necesitan su paquete), le pasa el papel a otro: lo escribe en su paquete («desde el cuadro siguiente, la autoridad es Beto») y todas cambian en el mismo cuadro. |
| **Relevo** | Cuando alguien se atrasa seguido, la autoridad lleva SUS botones en el paquete de ella (los de verdad si ya le llegaron, si no uno inventado) y todas las consolas, la de él incluida, usan esos. Nadie lo espera y no se agrega ningún viaje por la red: el paquete de la autoridad hacía falta igual. Como un relé de respaldo: si un lazo se cae, otro sostiene la línea. |
| **Botón inventado** | Lo que pone la autoridad por un relevado cuyo botón no llegó a tiempo. Si su último botón tiene hasta 6 cuadros, es ese mismo: sigue manejando él, con más retraso. Si es más viejo, solo acelerar (si lo tenía apretado), sin botones nuevos, y el volante se suelta de a poco en 30 cuadros, para que no se estrelle por un botón viejo. |
| **Corte en dos fases, con quietud** | Para quien se calla de golpe. El decisor (uno solo, siempre el mismo: el primero que sigue que no es él) pregunta a todos hasta qué cuadro llegan. Cada uno, al contestar, reparte lo que tiene del que se calló y **se queda quieto** ahí hasta saber la decisión. El corte va después del máximo: nadie corrió ese cuadro todavía, así que todas lo usan «sin nadie» desde ahí. Un corte fijado no cambia nunca. Como una maniobra en una subestación: primero todos confirman que están en posición, recién después se abre. |
| **Separarse (salir de la carrera)** | Si a una consola le llega un corte en un cuadro que ella ya corrió (no contestó a tiempo), su copia de la carrera ya no es la de los demás. Avisa (mensaje 14), sigue con todos quietos y vuelve en la carrera siguiente, como al recargar. No avisa «terminé» a la sala. |
| **Huella de los botones** | Además del avance de los 12 karts, la huella de cada 120 cuadros lleva una mezcla de todos los botones usados en cada cuadro. Si dos consolas usaron botones distintos aunque sea en un cuadro, se nota al toque, antes de que los karts se separen. Como el dígito de control de un número de cuenta. |
| **Ritmo (en el banco)** | Cuadros que corrió una consola ÷ los que tenía que correr en ese tiempo. 100 % = 60 cuadros por segundo (en el banco, 100 por segundo: cuadros de 10 ms). Si la sala espera a alguien, baja. |
| **Ponerse al día** | Correr cuadros más rápido para recuperar el tiempo perdido en una espera. Mario Kart Wii no lo hace (si un cuadro tarda, el juego va más lento) y el banco tampoco. Por eso quien espera queda un poco «atrás» para siempre, y su retraso tiene que cubrir eso. |

### La sincronía de tiempo (§80b)

| Término | Qué es y qué hace |
|---|---|
| **Ponerse al día (o no)** | Correr cuadros más rápido para recuperar el tiempo perdido en un tirón. Mario Kart Wii no lo hace: si un cuadro tarda, el juego queda más atrás y sigue a 60 desde ahí. En la sala eso deja a la consola que se trabó **desfasada** de las demás para el resto de la carrera. |
| **Desfase (ir adelante o atrás)** | Cuántos cuadros va una consola por delante de otra en el mismo instante. Corren la misma carrera, pero no en el mismo momento. Como dos relojes que dan la misma hora pero uno atrasado. |
| **Sincronía de tiempo** | Que el que va adelante se frene un poco para que el desfase vuelva a cero. Es lo que hace GGPO (la biblioteca de red de los juegos de pelea). Prendida desde que el dueño la eligió (§80b); `?sincroTiempo=0` la apaga. |
| **Frenarse un cuadro** | Esperar un cuadro sin hacer nada antes de tomar el siguiente. Como el juego no se pone al día, esa consola queda un cuadro más atrás. A lo más uno cada 8 cuadros. En pantalla, un cuadro repetido. |
| **Suelto / remolcado** | Un jugador que va atrás por un tirón suyo y después corre normal va **suelto**: frenarse por él lo alcanza. Uno que va atrás porque espera lo de los demás (su conexión trae todo tarde) va **remolcado**: si los demás se frenan, él se atrasa con ellos, y la sala iría más lenta para siempre. Solo se frena por los sueltos. |
| **Adelanto (del paquete)** | Un byte en cada paquete de botones: cuántos cuadros por delante de su cuadro de ahora está el último botón que manda. Con eso el que lo recibe sabe en qué cuadro iba el otro al mandarlo. |
| **Medida de ida y vuelta** | Yo mido «mi cuadro − el suyo al mandar» (desfase + lo que tarda la red); él mide lo mismo de mí (−desfase + lo que tarda la red). La mitad de la diferencia es el desfase: lo de la red se cancela. Es el método de los relojes por internet (NTP): un pulso de ida y otro de vuelta. |
| **Islas (la conexión partida en dos)** | Si la red se parte, cada lado ve que el otro se calló y lo corta. Al volver, cada uno se enteraría de que lo cortaron y se saldrían todos. Regla: sigue la isla con más jugadores (si empatan, la del mando más bajo, el de la autoridad); lo que diga la otra no vale, y los de la otra se salen de esa carrera. Como una red eléctrica que se separa: sigue la isla con más generación y la otra se apaga y se vuelve a enganchar después. |
| **Corte repetido** | El aviso de un corte se repite a todos cada medio segundo durante la carrera, porque un corte casi siempre viene de una conexión que se cayó, y justo ahí el aviso se pierde. |

### El aviso de la tarjeta de video equivocada (§81)

| Término | Qué es y qué hace |
|---|---|
| **Aviso con ventana (que se sostiene)** | Un aviso que no se enciende por un solo valor malo sino cuando la falla se repite: aquí, 8 segundos lentos entre los últimos 12. Un tirón de 5 s no lo prende. Como el relé térmico de un motor: un pico de corriente al arrancar no lo dispara, una sobrecarga que dura sí. |
| **Segundo de juego** | Para el aviso solo cuentan los segundos en que la lentitud puede ser de la tarjeta: pasado el arranque (cuadro 600), con la pestaña a la vista, sin esperar el disco y fuera de la sala (ahí la lentitud puede ser de otro jugador). Es como medir el consumo de un equipo solo con el equipo encendido y en régimen, no en el arranque ni en reposo. |
| **Trabajo por cuadro** | Los milisegundos que la página estuvo de verdad ocupada en cada cuadro (sin contar lo que esperó al reloj del juego). Si da pocos cuadros pero el trabajo es bajo, el juego estaba **esperando** algo y no es la tarjeta; si el trabajo pasa de 12 ms (de 16,7 disponibles), la PC no alcanza. |

### El VR de la sala (§82)

| Término | Qué es y qué hace |
|---|---|
| **Comparación por parejas** | Para el VR, cada carrera se parte en **pares de jugadores**: con 4 humanos hay 6 pares. En cada par, el que llegó antes «gana» y el otro «pierde». El cambio de cada uno es la suma de sus pares. Como un torneo de todos contra todos que se juega de una sola vez. |
| **Curva por puntos (B-spline cúbica)** | Una curva suave que pasa *cerca* de unos puntos fijos, no por encima. El juego guarda 5 valores (0, 1, 8, 50 y 125), uno cada 4999 de diferencia de VR, y la curva los une sin quiebres. Con ella sale cuánto vale ganarle a alguien según cuánto VR más o menos tenía. Como el filtro de reconstrucción de un conversor digital-analógico: de unas pocas muestras sale una señal continua. |
| **Suma cero** | En una carrera sin cortes, lo que gana uno es exactamente lo que pierde otro: la suma de todos los cambios es 0. El VR no se crea ni se destruye, pasa de unos a otros. Como la corriente en un nodo (ley de Kirchhoff): lo que entra es lo que sale. |
| **Peor caso guardado** | Al **empezar** la carrera, cada página guarda como su VR el que tendría si perdiera contra todos. Al terminar lo cambia por el de verdad. Si cierra o recarga la página a mitad de carrera, queda el peor caso. Así nadie se salva de perder VR yéndose. Como cobrar el depósito de garantía al arrendar: se devuelve al entregar en orden. |
| **Foto de los VR (congelar)** | Al empezar cada carrera, la anfitriona anota el VR de cada uno y lo reparte. Todas las consolas calculan esa carrera con esos números, aunque alguno cambie a mitad. Así lo que A le gana a B es justo lo que B le pierde a A. Como tomar todas las lecturas de un tablero en el mismo instante (muestreo simultáneo) antes de comparar. |
| **Gancho de prueba (comparar contra el juego)** | Una entrada de prueba en nuestro código nativo (`mkw_vr_prueba`). Le pide al juego mismo que calcule con **sus** funciones los puntos de un par, para cada una de las 19 997 diferencias posibles. La prueba compara número por número con nuestra fórmula. Como calibrar un instrumento nuevo contra el patrón en todos los puntos de la escala. Así se encontró que el paso es 1/4999 y no 1/5000. |

### Las copas que se separaban (§83, la C2)

| Término | Qué es y qué hace |
|---|---|
| **Función copiada adentro / llamada** | El traductor copia las funciones chiquitas (de 1 o 2 instrucciones, como `OS::GetTick`, «dame la hora del procesador») **dentro** de cada función que las usa, para no perder tiempo en ir y volver. Unas pocas partes del juego no la copian: la **llaman**, y van a la función original. `RELOJ_CARRERA` cambiaba las copias de las funciones de la lista, no la original. Como un tablero con medidores propios en cada circuito y un medidor general: cambiar los medidores de cada circuito no cambia el general. |
| **Sorteo de reserva (de los objetos)** | Hay un tope de objetos peligrosos a la vez en la pista (caparazones azules, rayos, Bill Bala…). Si la caja sortea uno que ya no tiene cupo, Pulsar (el motor de Retro Rewind) sortea **otro** con su propio dado. Es raro: en la copa que fallaba pasó por primera vez casi 100 s después de la largada. |
| **LCG (generador congruencial lineal)** | El dado de ese sorteo: `x ← x · 1103515245 + 12345` en cada tirada. Con la misma semilla da siempre la misma lista de números, y con otra semilla, otra lista. Es pseudoazar: parece al azar pero es una cuenta fija. Como un registro de desplazamiento con realimentación (LFSR) de la electrónica digital. |
| **Semilla estática** | Una variable que guarda su valor mientras el programa vive (no se borra al terminar la función). La del sorteo de reserva empieza en 0 y la primera vez que hace falta se llena con la hora del procesador. En la sala eso era la hora **de cada PC**, distinta en cada una. |
| **Objetos condicionales** | Objetos de una pista retro (los propios de Retro Rewind, números 0x1000 a 0x1FFF) que aparecen o no según una condición. Una es un número al azar del 0 al 7 que se sortea al empezar cada carrera. En contrarreloj vale 0, en línea usa un número que le pasa el juego y en VS salía de la hora de cada PC. |
| **Vigía del reloj** | Un programa de depuración (`MKW_DEPURAR_RELOJ=1`): cada lectura de la hora del procesador en todo el juego anota en la consola quién la leyó, desde dónde y en qué cuadro de la carrera. Como poner un amperímetro en cada rama de un circuito para encontrar la que se lleva la corriente que falta. |
| **Disparador determinista** | Una falla que cae **siempre en el mismo cuadro** con la misma semilla y pistas (aquí, ~6100 de la carrera 1). Que no varíe dice que la dispara algo de la carrera misma (un objeto que se sortea en ese momento), no la red ni la carga de la PC, que cambian en cada corrida. |
| **Mapa de símbolos** | Una lista de «dirección → nombre de la función» (`terceros/Wiicompiled/projects/mkwii/MAP.txt`, de la comunidad). Con ella `0x801AAD74` se lee `OS::GetTick` y `0x8051DFC0` se lee «el menú HOME». Es como el plano con los nombres de los equipos de una subestación. |
| **Kit (del sitio)** | La copia de **nuestro** trabajo (páginas, `.mjs`, C++ propio, banco, documentos) que viaja dentro del sitio, en `terceros/Paginita-Pro/juegos/mkw/`. La arma `herramientas/subir-kit.sh` con la lista de git: lo que no está en `.gitignore`, o sea nada del juego. Es como el juego de planos que se le entrega al cliente: los planos sí, los equipos de otro fabricante no. |
| **Separador de ruta (`/` y `\`)** | El signo que separa las carpetas en una dirección de archivo. Linux, macOS y la web usan `/` (`colabtex/src/juegos/worms.js`); Windows usa `\` (`colabtex\src\juegos\worms.js`). Una prueba que compara direcciones como texto falla en Windows si no cambia `\` por `/` antes. Es la misma dirección escrita con otra norma, como 1,5 y 1.5. |

### Multijugador local directo y los 200cc (§84)

| Término | Qué es y qué hace |
|---|---|
| **Registro de mandos** | La pantalla del juego «Controller Registration» (sección 0x54, página 0x62). Muestra el mando del jugador 1 y espera que cada uno de los demás apriete A en **su** mando; recién ahí sigue al menú de VS y Batalla. Como pasar lista: cada uno levanta la mano desde su asiento. |
| **Lo que hace un botón antes de cambiar de pantalla** | El botón «2/3/4 Players» del menú principal no solo cambia de sección. Antes anota cuántos juegan, marca personas y CPU en la ficha de los menús y suelta los mandos de los puestos que sobran. Abrir directo por código tiene que hacer eso mismo; si no, la pantalla nueva cree que el mando del jugador 1 se desconectó. Como una maniobra que manda cerrar un interruptor: antes los enclavamientos tienen que estar en su posición. |
| **Cantidad de jugadores locales** | Cuántas personas juegan en la misma consola (2, 3 o 4, cada una con su mando y su pedazo de pantalla). El juego la guarda en SectionParams +292, y con ella arma el registro de mandos y la pantalla partida. |
| **Rótulo vs. valor (100cc → 200cc)** | El sitio guarda la cilindrada con una clave (`c100`) y muestra un texto. La clave es la cilindrada 100cc del juego, pero Retro Rewind corre esa cilindrada como **200cc** (y la 50cc como su «500cc»). El valor estaba bien; el texto decía otra cosa. Como un tablero con la etiqueta de un interruptor equivocada: el circuito funciona, pero quien lo lee se confunde. |
| **Medir para comprobar** | Para saber qué cilindrada corre de verdad: la misma carrera con cada una, y cuánto avanzaron las 11 CPU en el cuadro 1500. Si «100cc» avanza más que 150cc, no es 100cc. Como medir la velocidad de un motor con un tacómetro en vez de creerle a la placa. |

### La PC que no alcanzaba en la sala (§85)

| Término | Qué es y qué hace |
|---|---|
| **Margen (de un cuadro)** | Lo que sobra de los 16,7 ms de cada cuadro después de hacer el trabajo. Como el margen de una fuente de poder: una fuente de 100 W que entrega 95 W anda, pero cualquier carga de más la hace caer. La carrera de la sala deja 0–2 ms de margen en este PC; una carrera sola, ~7 ms. |
| **Todo a la vista** | El arreglo de §61 para que la carrera dé igual en todas las consolas. El juego anota qué objetos ve la cámara, y parte de la lógica actualiza menos lo que no se ve. Como cada consola mira desde otro kart, se marca todo como «a la vista y cerca», igual en todas. El costo: se dibuja y se actualiza toda la pista con todo detalle. Como dejar encendidas todas las luces del edificio para que los sensores de todos los pisos lean lo mismo. |
| **Dibujar siempre** | El arreglo de §62: Retro Rewind se salta el dibujo de un cuadro si va atrasado, cada PC en otro momento, y eso separaba la carrera. En la sala se dibujan todos. Una PC lenta va más lenta, en vez de saltarse dibujos. |
| **Núcleo físico y núcleo lógico** | El procesador de este PC (Ryzen 7 9800X3D) tiene 8 núcleos físicos, 8 procesadores de verdad. Cada uno puede llevar 2 hilos a la vez: son los 16 núcleos «lógicos» (SMT). Dos hilos en el mismo núcleo físico se reparten sus partes, como dos cargas colgadas del mismo transformador. |
| **Afinidad (de un proceso)** | La lista de núcleos en los que Windows deja correr a un proceso. Sirve para un experimento: fijar cada pestaña en su núcleo propio y ver si iba lenta porque compartía núcleo. Aquí ayudó poco (56 → 59 cuadros/s): el costo era del trabajo, no del reparto. |
| **Medidor aparte** | Una segunda medida, independiente, para comprobar la primera. El aviso cuenta los cuadros del lockstep; el medidor de la página cuenta los cuadros del juego y escribe una línea por segundo. Si el aviso dice «va a 48», el medidor tiene que haber visto lo mismo. Como comprobar con un voltímetro aparte lo que marca el panel. |
| **Codificador de video (de la tarjeta)** | Un circuito de la tarjeta de video que comprime la imagen en video al momento. Discord lo usa para transmitir o compartir la pantalla. Ocupa la tarjeta y algo del procesador, aunque no se vea nada en pantalla. |
| **Unión de carpetas (junction)** | Una carpeta que en realidad apunta a otra (`mklink /J`): entrar en ella es entrar en la original. Como un puente entre dos bornes: lo que haces en un lado pasa en el otro. Al borrar hay que quitar el puente primero (`cmd /c rmdir`), si no el borrado sigue hacia la original. |
| **`git archive`** | Saca los archivos de un commit viejo a una carpeta suelta. No cambia de rama ni toca el trabajo en curso. Sirve para compilar y probar «el código de antes» al lado del de hoy. |

### Los Mii invitados con las caras del juego (§86)

| Término | Qué es y qué hace |
|---|---|
| **Mii invitado (Mii «por defecto»)** | Los 6 Mii que trae el juego y que no son de nadie: la pestaña «Guest» de «Elige un Mii». No viven en la base de Mii de la consola (RFL_DB.dat) sino en una tabla dentro del programa: 6 × 74 bytes en 0x8024C4D0, con el mismo formato de un Mii normal. Se llaman «no name»: 3 chicos y 3 chicas. Como las piezas de muestra que trae un tablero de fábrica: sirven aunque no hayas armado ninguna. |
| **Librería de caras de la Wii (RFL)** | El código de Nintendo que todos los juegos de Wii usan para los Mii (Revolution Face Library): lee la base de Mii, guarda los 6 invitados y dibuja las cabezas en 3D. Mario Kart la llama para cada Mii que muestra. |
| **Grupo de Mii (MiiGroup) y el que dibuja (MiiRenderMgr)** | Un MiiGroup es la «bandeja» de Mii de una pantalla: hasta N Mii y, para cada uno, sus texturas (la foto de la cara en cada tamaño que se use). El MiiRenderMgr es quien saca esas fotos: dibuja la cabeza en 3D y la copia a la textura. «Elige un Mii» arma un grupo de 10; aquí se arma uno de 6 solo para la foto. |
| **Copia a textura (`GXCopyTex`)** | Dibujar algo fuera de la pantalla y guardarlo como una imagen para usar después. Así se hacen las caras de los Mii: el juego dibuja la cabeza y la copia a una textura de 96×96 que después pega en el menú. Como sacar una foto del tablero y usar la foto en vez del tablero. |
| **RGB5A3** | Un formato de textura de la Wii: 16 bits por píxel. Si el bit de arriba es 1, el píxel es opaco con 5 bits por color; si es 0, lleva 3 bits de opacidad y 4 por color (para los bordes suaves). Las caras de los Mii vienen así. Como un conversor de 16 bits que usa una escala u otra según un bit de rango. |
| **Bajar de la tarjeta de video (lectura de vuelta)** | aurora hace las copias a textura en la tarjeta de video y no las pasa a la memoria del juego si nadie las lee (bajarlas cuesta tiempo). `aurora_flush_efb_copy_to_ram` pide bajar una: aurora la escribe en la memoria del juego con el formato de la Wii. Hay que pedirlo en el mismo cuadro: al cerrar el cuadro aurora olvida el pedido. Como un osciloscopio que guarda la captura solo en pantalla: hay que mandarla a la memoria antes del siguiente disparo. |
| **Montón cerrado (`dameFlag`, «DAME DAME»)** | Los montones de memoria del juego (EGG::Heap) tienen una bandera: con el bit 0 prendido, pedirles memoria detiene el juego con el aviso «DAME DAME» («¡no, no!» en japonés). El juego los cierra cuando termina de armar una escena, para atrapar pedidos fuera de lugar. Como un tablero con el candado puesto: se abre para la maniobra y se vuelve a cerrar. |
| **Montón actual** | El montón de donde saca memoria un `new` que no dice de dónde (EGG::Heap::current). Mientras una pantalla se arma, es el de la escena; en medio del cuadro es otro (y cerrado). |
| **Sección «armándose» y pedido en fila** | Section +0x38F = 1 mientras la sección se arma. En ese momento MiiGroup::AddMii dibuja la cara en el acto; con la sección andando deja un pedido en una fila y la dibuja en otro cuadro. Para tener las 6 en el mismo cuadro, la página marca «armándose» solo mientras las carga. |
| **PNG** | Un formato de imagen sin pérdida (lo que entra sale igual), comprimido. La página guarda así las 6 caras en IndexedDB. |
| **Alfa premultiplicado** | Una forma de guardar los píxeles semitransparentes con el color ya multiplicado por su opacidad. El `<canvas>` del navegador trabaja así y, al ida y vuelta, un píxel de borde suave puede cambiar ±1 de 255. Lo opaco y lo transparente quedan exactos. |
| **Información adicional del Mii (RFL::AdditionalInfo)** | Lo que el juego guarda de un Mii al cargarlo de la base: nombre, CreateID, chico/chica, color favorito, altura y complexión (Mii +0x68). La prueba la lee para comprobar que el juego cargó el Mii con lo del invitado elegido. Los 74 bytes crudos (Mii +0x10) el juego solo los llena para un Mii que viene de un archivo o de la red. |

### La sala: el inicio de la playlist, el cupo y echar (§87)

| Término | Qué es y qué hace |
|---|---|
| **Condición de carrera (en el programa)** | Una falla que depende de qué llega primero. Aquí el selector de sugerir tardaba en «quedar armado» (esperaba los nombres de las pistas por la red) y, mientras tanto, llegaban más estados de la sala; cada uno creía que no había selector y abría otro. Si los nombres llegaban rápido no pasaba nada. Como dos relés que se cierran casi juntos: el resultado depende de cuál gana por microsegundos. |
| **Marca de «abriendo»** | Una variable (`abriendoSug`) que se prende al instante, ANTES de esperar nada, y dice «ya hay un selector en camino». Los estados que llegan mientras tanto la ven y no abren otro. Como el piloto de un tablero que se enciende apenas se da la orden, no cuando el motor ya arrancó. |
| **Selector huérfano** | Un selector abierto en la pantalla sin nadie que lo pueda cerrar: la página guardaba solo el control del último. Cuando la anfitriona confirmaba, la página cerraba ese y el otro quedaba encima del juego, tapando la pantalla de personaje. |
| **Cupo de la sala** | Cuántos humanos caben en una sala del sitio. En Mario Kart es 4: cada piloto es un jugador «local» de verdad en todas las consolas, y el juego admite 4 mandos. La CPU completa los 12 lugares. Ya no se pregunta: toda sala nace con 4. |
| **Echar (al anfitrión)** | El anfitrión saca a alguien de la sala con el botón «Echar». Es una jugada más del registro (`{t:"echa"}`), y el sitio la convierte en «se fue» solo si quien la escribe es el anfitrión en ese momento. Como el jefe de turno que puede retirar a alguien de la sala de control. |
| **Votación para echar** | La de todos los juegos del sitio (⏏): si la mayoría de los demás vota contra alguien, sale. En Mario Kart se ofrece con 3 o más pilotos; con 2, votar sería echar solo, y eso le toca al anfitrión. |

### El sonido por AudioWorklet (§88)

| Término | Qué es y qué hace |
|---|---|
| **Hilo de audio** | Un hilo del navegador, aparte del de la página y de prioridad alta (tiempo real), que solo calcula sonido y se lo pasa a la tarjeta. Si la página se traba, él sigue. Es como el DMA de un conversor: el procesador puede estar ocupado y las muestras igual salen a tiempo. |
| **AudioWorklet / AudioWorkletProcessor** | Un pedacito de programa de la página que corre **en el hilo de audio**. El navegador le pide 128 muestras por vez (`process()`), siempre a horario. El nuestro es `web/navegador/sonido-worklet.js`. |
| **Bloque de render (128 muestras)** | Lo que el navegador le pide al worklet cada vez: 128 muestras por canal = 2,7 ms a 48 kHz. El ScriptProcessorNode de SDL3 pedía 2048 (42,7 ms): 16 veces más grande. |
| **postMessage / puerto (MessagePort)** | La forma de mandar datos de un hilo a otro sin compartir memoria: el mensaje viaja como una carta (se copia o se "transfiere"). La página le manda al worklet cada pedazo de sonido así, ~330 cartas por segundo. |
| **Transferir (transfer)** | Mandar un búfer a otro hilo **sin copiarlo**: el que lo manda lo pierde y el otro lo recibe tal cual (como pasar la caja entera en vez de fotocopiar su contenido). |
| **Memoria compartida (anillo con SharedArrayBuffer)** | La otra forma: los dos hilos leen y escriben la misma memoria (un anillo) sin cartas. Necesita que la página esté "aislada" (COOP/COEP), y el sitio de GitHub Pages no lo está: por eso van cartas. |
| **Búfer antisaltos adaptable (jitter buffer)** | Una cola que guarda lo justo para tapar los tirones de quien la llena, y que se agranda sola si un tirón la vació (y se achica con la calma). Lo usan las llamadas por internet. La nuestra arranca en 25 ms. |
| **Objetivo de la cola** | Cuánto sonido debe esperar en la cola, en promedio. El ajuste de ritmo (el PI de §36) la mantiene ahí, como un regulador mantiene la tensión en su referencia. |
| **Vacío / hueco / salto** | Los tres contadores del worklet. **Vacío**: la cola se quedó sin sonido. **Hueco**: un vacío que cortó sonido (se oye; si era silencio, no). **Salto**: llegó tanto junto que se descartó lo viejo, con un fundido cruzado. |
| **Fundido (de entrada / de salida / cruzado)** | Subir o bajar el volumen de a poco en vez de golpe, para que no suene un "clic" (un escalón en la onda tiene armónicos de todas las frecuencias). Cruzado: lo de antes baja mientras lo nuevo sube, como el crossfader de un mezclador de DJ. |
| **Descarte de silencio** | Si sobra cola y lo que viene es silencio, se tira enseguida: no se oye y la demora vuelve al objetivo sin esperar al ajuste de ritmo. |
| **Clic de prueba (medir la demora)** | Para medir la demora de punta a punta: el juego queda mudo, el runtime mete un clic (4 muestras al máximo) anotando la hora, y la salida dice en qué muestra de la tarjeta salió. Es medir el retardo de propagación con un pulso y el osciloscopio. |
| **getOutputTimestamp / baseLatency / outputLatency** | Lo que el navegador dice de su propia demora: `getOutputTimestamp()` = qué muestra está sonando en el parlante ahora y a qué hora; `baseLatency` = su búfer (10 ms aquí) y `outputLatency` = el de Windows y la tarjeta (40 ms aquí). La página no los puede achicar. |
| **`?audio=viejo`** | El camino de antes (el ScriptProcessorNode de SDL3), para comparar o si algún navegador no tuviera AudioWorklet. |

### El programa final y el paso 0 de publicar (§89)

| Término | Qué es y qué hace |
|---|---|
| **Programa final (`--final`)** | El `.wasm` que se sube a R2 para los amigos: el mismo juego, pero sin los nombres de las funciones (solo sirven para medir dónde se va el tiempo) y ya comprimido (`mkw.wasm.br`, 15,7 MB). Es la versión "de fábrica" de un equipo: sin los puntos de prueba soldados en la placa. |
| **Paso 0 (de publicar)** | Lo que hace Claude antes de que el dueño suba nada: compilar el programa final con el código del momento, hacerle sus semillas y pasarle todas las pruebas. Recién con eso en verde el dueño sube a R2 (`docs/publicar.md`). Es la prueba de aceptación en fábrica (FAT) antes de despachar. |
| **Taller (`--carpeta`) y salida (`--salida`)** | El taller es la carpeta donde quedan los objetos de cada archivo compilado; la salida, donde queda el programa armado. Se pueden separar: aquí el taller es `build/web-m8` y la salida `build/web-final/navegador`, así nada pisa el `build/web` de todos los días de las otras sesiones. Como tener un banco de armado aparte para la serie que se despacha. |
| **Compilación incremental** | Volver a compilar solo lo que cambió desde la vez anterior (Ninja compara las fechas). Aquí fueron 19 de 590 archivos y el resto se reusó: minutos en vez de horas. Como rebobinar solo la bobina que se cambió, no el motor entero. |
| **Probar con el programa final (`MKW_BUILD`)** | Las pruebas abren el juego que está en `build/web/navegador`, salvo que `MKW_BUILD` diga otra carpeta. Con `MKW_BUILD=build/web-final/navegador` prueban justo el programa que se va a subir, con sus semillas, y no uno parecido. |
| **Copiar lo commiteado (no la copia de trabajo)** | El kit del sitio se llenó con los archivos tal como están en el último commit (`git archive HEAD`), no como están en la carpeta. Si otra sesión tiene algo a medio hacer en la carpeta, eso no se cuela al sitio. |

### Dónde guarda Retro Rewind sus trofeos (§90, la C8)

| Término | Qué es y qué hace |
|---|---|
| **Carpeta del mod** | La carpeta propia de Retro Rewind dentro de la memoria interna de la Wii (la NAND): `shared2/Pulsar/RetroRewind6`. Ahí escribe sus trofeos, fantasmas y ajustes. Como el cajón de un tablero donde un equipo agregado guarda sus planos, aparte de los del equipo original. |
| **CRC32** | Una suma de control de 32 bits: un número que sale de todos los bytes de un archivo, y cambia si cambia cualquier byte. Pulsar nombra la carpeta de cada pista con el CRC32 de su archivo (`Trophies/44e5205f/`), así dos versiones de una pista no se mezclan. Como el dígito verificador de un RUT, pero para un archivo entero. |
| **`.pul`** | Los archivos que escribe Pulsar (el motor de Retro Rewind): `Trophy.pul` (el trofeo de una pista), `ldb.pul` (la tabla de mejores tiempos de una pista), `RRGameSettings.pul` (los ajustes). |

### Doce jugadores en la sala (§91, la C9)

| Término | Qué es y qué hace |
|---|---|
| **Puerto de mando** | Una de las 4 entradas de mando de GameCube que tiene la consola. El juego solo conoce 4: un jugador local de verdad necesita uno. Como las 4 entradas de un osciloscopio de 4 canales. |
| **Mando virtual (portador virtual)** | Para los jugadores 5 a 12 de la sala, que no tienen puerto: `mandos_virtuales_nativo.cpp` les da un "mando" hecho por nosotros que el juego lee igual que uno de verdad, y le pone los botones que llegan por la red. Como agregar canales a un osciloscopio con un multiplexor: el instrumento sigue viendo una entrada, pero llegan más señales. |
| **Arreglo y su desborde** | Un arreglo es una fila de casillas de memoria del mismo tamaño, una detrás de otra (la lista de jugadores humanos de la IA tiene 4). Si se escribe una casilla más allá de la última, se pisa lo que viene después en la memoria (aquí, un puntero de la IA): eso es un desborde. Como un registro de desplazamiento de 4 etapas al que le meten 5 bits: el quinto se derrama en el registro vecino. |
| **Prestar como CPU** | Truco de §91 para el armado de pantallas del juego (`InitScreens`), que solo sabe de 4 locales: mientras corre, los humanos 5 a 12 figuran como CPU (así no les busca puerto ni pantalla); al terminar vuelven a ser humanos sin pantalla. Como puentear unos bornes durante la puesta en marcha y sacar el puente después. |

### La Contrarreloj contra el mejor de la página (§92)

| Término | Qué es y qué hace |
|---|---|
| **Fantasma (`.rkg`)** | La grabación de una vuelta de Contrarreloj: el personaje, el vehículo, el Mii y **los botones de cada cuadro**, comprimidos (unos KB). Al correr "contra el fantasma", el juego reproduce esos botones y el kart fantasma hace exactamente la misma carrera. Como grabar la señal de entrada de un sistema y volver a inyectarla: la salida sale igual. |
| **Fantasma experto** | El fantasma que trae Retro Rewind para cada pista (el que hay que batir para ganar el trofeo). Es el que el juego carga si la persona elige "correr contra el fantasma" desde la pantalla de fantasmas; la página lo cambia por el del mejor tiempo de la página. |
| **Tabla de récords de la página** | La lista de mejores tiempos de cada pista en Firebase (la que ya mostraba la página, `records`). Ahora cada récord nuevo sube también su fantasma a Firebase Storage (`mkw/fantasmas/<pista>-tt150/<uid>.rkg`), y quien corre contra el fantasma baja el del primero que tenga uno. |

### La largada tolerante y el paquete de diminutos (§93, la C4 y la E2)

| Término | Qué es y qué hace |
|---|---|
| **Margen de largada** | En los primeros 10 s de cada carrera sincronizada, el tiempo que se espera a un jugador que no manda sus botones antes de seguir sin él sube de 2 s a 15 s (y hasta 45 s si su página sigue contestando). La primera vez que alguien juega, su navegador se puede trabar unos segundos justo al largar armando gráficos y leyendo el disco: no es que se fue. Como el retardo de arranque de un relé de protección de un motor: en la partida se tolera más corriente que en régimen. |
| **Latido del buzón (presencia)** | Cada página avisa "sigo aquí" cada segundo en el buzón de la sala (por donde se presentan las páginas antes de conectarse por WebRTC). El buzón de pruebas da por ido a quien no late en 4 s. Antes, la malla cortaba la conexión WebRTC de quien se dejaba de ver en el buzón, aunque esa conexión siguiera sana; ahora solo la corta si la conexión también se cayó. |
| **Archivo diminuto** | Un archivo del disco de 8 KB o menos (hay ~600: fantasmas, íconos, voces, ajustes). Bajar uno cuesta casi solo la ida y vuelta a la red (~50 ms), no su tamaño. |
| **Paquete de diminutos (`diminutos.bin`)** | Los ~600 archivos diminutos juntos en un solo archivo de 1,5 MB, con un índice al principio (qué archivo es y cuánto mide). La página lo baja de un pedido y deja cada archivo listo en la memoria. Antes eran ~600 pedidos. Como una regleta: en vez de 600 enchufes a la pared, uno solo. Es contenido del juego: va a R2, nunca a git. |
| **Fijo (en la memoria)** | Un archivo que la página guarda en la memoria y que nunca se descarta (los del paquete). El resto de la memoria del disco es un recambio de 64 MB: lo más viejo sale cuando entra algo nuevo. |
| **Fila baja** | La lista de cosas que la página baja "por si acaso" (la semilla de bloques, las voces de los CPU), de a pocas y solo cuando el juego no está cargando, para no quitarle la red a lo que el juego espera ahora. |
| **Latencia contra ancho de banda** | La latencia es cuánto tarda un pedido en empezar a llegar (~50 ms hasta R2); el ancho de banda, cuántos bytes por segundo caben (50 Mbit/s de una casa). Con archivos chicos manda la latencia; con grandes, el ancho de banda. Como en una línea de transmisión: el retardo de propagación contra la capacidad del conductor. |

### El descanso, la parrilla y el VR entre carreras (§94)

| Término | Qué es y qué hace |
|---|---|
| **Descanso (entre carreras)** | Los 30 s entre el fin de una carrera de la sala y la siguiente (antes eran 9): se ven los resultados, el VR, y en la playlist se agregan o sugieren pistas. Un panel al costado muestra la cuenta. Como el tiempo muerto de un reconectador entre dos intentos: fijo, y conocido por todos los que esperan. |
| **Cuenta que vuelve a 15 s** | Si en el descanso alguien agrega o sugiere una pista y quedan menos de 15 s, la cuenta vuelve a 15 s (con más de 15 s no cambia). Así nadie queda a mitad de elegir. Como un monoestable redisparable: cada disparo nuevo le da al menos su ancho de pulso, sin acumular más. |
| **Parrilla de salida** | El orden en que los 12 karts esperan la largada (el 1.º adelante). En Mario Kart cada uno larga la carrera siguiente en el puesto en que llegó a la anterior. |
| **Puesto anterior (`+0xE1`)** | Un byte de la ficha de cada jugador en Racedata: el puesto con que "viene" de la carrera anterior. El juego arma la parrilla con él (medido en §94). En el camino directo de la sala nadie lo escribía desde la segunda carrera: ahora lo escribe la página con la llegada. |
| **Llegada** | Los 12 puestos en que terminó cada uno una carrera (el del juego, `RaceinfoPlayer +0x20`). Cada página la manda con su aviso de «terminé» y la anfitriona la reparte en el estado de la sala: la parrilla de la siguiente sale de ahí, igual en todas las consolas. |
| **Cerrojo de los botones** | En la sala, después de una carrera, los botones de la persona llegan al juego solo en la carrera y en la pantalla de resultados. Antes, apretando A se pasaba a la tabla de puntos y de ahí al menú propio del juego (carrera siguiente), que largaba otra carrera fuera de la sala. Como un enclavamiento (interlock) en un tablero: con la puerta abierta el contactor no cierra, aprieten lo que aprieten. |
| **Hora de la anfitriona (desfase)** | Los plazos de la sala (elegir, descanso) son horas del reloj de la anfitriona, y el reloj de cada PC no da exactamente la misma hora. Cada reparto del estado lleva la hora de ella y cada página anota la diferencia con su reloj: así la cuenta dice lo mismo en todos. Como sincronizar los relojes de varias subestaciones con una señal de referencia antes de comparar sus registros. |

### El VR con las CPU (§95)

| Término | Qué es y qué hace |
|---|---|
| **Puesto general** | El puesto entre los 12 corredores, humanos y CPU juntos. Desde §95 el VR de la sala se mueve con él: ganarle a una CPU también suma, y que una CPU te gane también resta. Antes (§82) solo contaba el orden entre los humanos. |
| **Ancla (de la CPU)** | El VR fijo con que cuenta cada CPU: 5000 la difícil (150cc y espejo), 3000 la normal (100cc). La CPU no tiene VR guardado: nunca sube ni baja. Como una fuente de tensión ideal en un circuito: fija la referencia y no se mueve por lo que le conecten. |
| **Peso de una CPU** | Cuánto vale ganarle (o perder) a una CPU comparado con un humano del mismo VR: 1/4. Un humano vale como 4 CPU. |
| **Tope (de las CPU)** | Todas las CPU juntas valen a lo más lo de 2 humanos. Con hasta 8 CPU cada una vale 1/4; con 9, 10 u 11, cada una vale 2 ÷ cuántas. Así, en una sala de 2 humanos y 10 CPU, el otro humano sigue pesando la mitad de lo que pesan todas las CPU juntas. Como un limitador de corriente: deja pasar proporcional hasta un valor, y de ahí no más. |
| **Equilibrio (del VR)** | El VR donde, en promedio, lo que se gana por ganarle a las CPU es igual a lo que se pierde cuando ellas ganan: ahí el VR deja de subir. Quien le gana al 90 % a cada CPU difícil se queda en ~8200. Es un lazo de control con realimentación negativa: cuanto más VR tienes, menos te dan por ganar y más te quitan por perder, y el VR vuelve solo al punto de trabajo. |
| **Inflación (de VR)** | Que el VR de todos suba sin fin solo por jugar, sin que nadie juegue mejor. Pasaría si cada CPU tuviera de ancla el VR de los mismos humanos (la referencia se mueve con la salida: el lazo no tiene punto fijo). Con anclas fijas no pasa. |
| **Granja de VR (cuenta alterna)** | Hacer subir el VR propio con una segunda cuenta que se queda quieta y llega última siempre. Con la regla de §82 (solo humanos) una persona común llegaba a ~10 500 en 2000 carreras; con §95, a ~5300: la cuenta alterna ya casi no regala nada, porque lo que cuenta son las CPU. |
| **Crítico externo** | Un revisor independiente (otro agente, con el diseño escrito y el código, sin la conversación) que recalculó todo por su cuenta, simuló miles de carreras y buscó cómo abusar del sistema. Como el ensayo de un tablero por un laboratorio que no lo armó. |
| **Puestos creíbles** | Los puestos que da el juego sirven solo si cada CPU tiene uno del 1 al 12 y no se repite ninguno. Si una lectura falla (una CPU con puesto 0 quedaría «detrás de todos» y le regalaría puntos a cada humano), la parte de las CPU no se cuenta. |
| **Regla congelada** | La anfitriona pone la regla de las CPU (anclas, peso, tope) en la foto de cada carrera, junto con los VR (`vrCarrera.cpu`). Así todas las consolas cuentan con la misma regla aunque alguna tenga otra versión de la página. |

### Los niveles de la CPU (§96)

| Término | Qué es y qué hace |
|---|---|
| **Perilla (de la CPU)** | Un número que el juego lee al empezar cada carrera y que decide qué tan buena es una CPU: su velocidad base, cuánto se puede atrasar, cuánto se frena si va adelante, el «arrebato», etc. Los niveles fácil/normal/difícil del juego no son código distinto: son filas distintas de estas perillas. Como los potenciómetros de ajuste de una fuente: el circuito es el mismo, lo que cambia es dónde está cada perilla. |
| **Velocidad base de la CPU** | 70 + un valor de la tabla del juego. Para una CPU en el suelo **reemplaza** la velocidad base de su vehículo (después se le aplican los mismos turbos que a un humano y el tope del juego, 120). Un humano a 150cc tiene 75 a 86 según vehículo y personaje; la CPU difícil del juego, ~75. |
| **Elástico (de la CPU)** | El ajuste de velocidad según la distancia: cada CPU tiene una «casilla» (cuánto se le permite ir detrás de la mejor CPU); si va más atrás gana hasta +10, si va más adelante se frena hacia su velocidad mínima. Se mide contra la mejor CPU, no contra el humano. Como un lazo de control que mantiene al pelotón junto: la referencia es la CPU que va primera. |
| **Arrebato** | Una vez por carrera, durante 50 a 70 s, la CPU que va primera persigue al mejor humano (va a la velocidad base del humano + 2 a 12) y la 2.ª y la 3.ª la siguen con la mitad y un quinto. En el juego pasa el 80 % de las veces en difícil. |
| **Fila (de la tabla del juego)** | El nivel que el juego usa para leer sus perillas: 0 fácil, 1 normal, 2 difícil. La página manda una fila un nivel más arriba que antes (fácil → su normal; normal, difícil y máximo → su difícil). |
| **Nivel «máximo»** | El nivel nuevo de la página: la fila difícil del juego y, encima, todo al tope: la velocidad base del kart humano más rápido (~86 a 150cc), sin frenarse por ir adelante, el arrebato siempre y toda la carrera, la tinta sin efecto y los objetos de la tabla del humano. |
| **Gancho de la carga de la IA** | Nuestra función que envuelve a la del juego que carga las perillas (AI::Params::Load): deja que el juego cargue su fila y escribe encima los valores del nivel. Corre en el mismo momento en todas las consolas (al armar la carrera), así la sala sigue sincronizada. |
| **Guardia (de una escritura)** | Antes de escribir en una tabla del juego, el gancho comprueba que ahí esté el valor que se leyó en el código; si no, no escribe y lo avisa. Como medir que no haya tensión antes de tocar un borne: si algo no es lo esperado, no se toca. |

### El vestíbulo nuevo de la sala (§97)

| Término | Qué es y qué hace |
|---|---|
| **Maqueta** | Un dibujo de una pantalla que se puede tocar, hecho con datos de mentira, para elegir un diseño antes de programarlo. Como un prototipo en protoboard antes de diseñar la placa. |
| **Jerarquía visual** | El orden en que el ojo recorre una pantalla: lo más grande, lo de color más fuerte y lo de arriba se ve primero. En un unilineal, la barra principal se dibuja gruesa y los ramales finos: se entiende el circuito sin leer todos los rótulos. |
| **Control deshabilitado (apagado)** | Un botón que se ve pero no se puede apretar. Si se ve gris pero con forma de botón, parece descompuesto: por eso el invitado ya no ve los botones del anfitrión, solo lo elegido. |
| **Ficha de carrera** | La parte de arriba del vestíbulo nuevo: lo que se corre en grande («Copa · 150cc · CPU máximo») y, al lado, «¡A correr!» (el anfitrión) o lo que se espera (el invitado). Se ve sin bajar la página, haya 2 o 12 pilotos. |
| **Menú «⋯»** | Un botón chico en la fila de cada piloto (solo para el anfitrión) que abre «Pasar anfitrión» y «Echar». Saca del medio lo que se usa poco. |
| **Consulta de contenedor (`@container`)** | Una regla de estilo que cambia el diseño según el ancho del **panel** y no el de la ventana. Hace falta porque el panel comparte la fila con el chat: una ventana ancha puede tener un panel angosto. |
| **Firma (del repintado)** | El vestíbulo se rehace entero cada vez que cambia algo (alguien entra, llega un VR). Antes de rehacerlo arma una «firma» con todo lo que se ve; si no cambió, no lo toca. Lo abierto (el «⋯», «Cambiar», la tabla) va en la firma, y el foco del teclado vuelve al mismo botón. Como el contacto de enclavamiento de un relé: guarda el estado aunque la orden se repita. |
| **Foco (del teclado)** | El recuadro que marca qué botón responde a Enter cuando se maneja la página con el teclado (Tab). |

### El «Modo consola»: antes, durante y entre carreras (§98)

| Término | Qué es y qué hace |
|---|---|
| **Modo consola** | El nombre del modelo de mejora que recomendó el crítico y eligió el dueño: la página deja de hablar encima del juego y habla en las pausas, con la letra y los colores del juego (como una consola de verdad, donde todo lo dice el mismo aparato). Como un tablero de operador bien hecho: en marcha normal solo el proceso; las alarmas en su ventanilla y con su color. |
| **Zócalo** (*lower third*) | La franja baja de la tele que informa sin tapar la imagen («Gol de…»). El descanso entre carreras pasó de un panel a la derecha (tapaba los puntos de los puestos 4.º a 9.º de la tabla del juego) a un zócalo de una línea abajo: la copa, la cuenta, tu puesto y tu VR, la pista que sigue y los botones. |
| **Superposición** (*overlay*) | Algo que la página dibuja encima de la imagen del juego (el contador DNF, las marcas de VR, el podio). Como un acetato sobre un plano: el plano no cambia; lo de arriba se pone y se saca. |
| **Marca de VR (en la tabla)** | El «+13 VR» o «-17 VR» que la página escribe con la letra del juego al lado de la fila de cada humano en la tabla de puntos del juego, en la franja libre de la derecha. La fila sale de los puntos y la llegada de la sala (`filasDeTabla`). |
| **Capas de avisos** | Dónde va cada aviso según su urgencia: al centro solo lo de la carrera (esperar a alguien, un corte); en la esquina de arriba a la izquierda el estado (📶 alguien va lento, la PC lenta), 6 s cada vez que cambia (nada queda encima de la imagen toda la carrera: cuesta cuadros); abajo el zócalo de las pausas; arriba el cartel de quien recargó. Como en un tablero: alarma, indicador y placa de datos no van en el mismo lugar. |
| **Podio** | Al terminar la copa, 8 s con «¡GANÓ …!» y los tres primeros (con el VR que ganó o perdió cada humano en la copa) con la letra del juego, y después la vuelta al vestíbulo. |
| **Modo inmersivo (al empezar, opcional)** | La pantalla completa del sitio (sin cabecera, el chat flotando encima). Si la persona prendió «Pantalla completa al empezar» en el vestíbulo (apagado por omisión), al empezar la copa la sala lo pone sola y lo saca al volver al vestíbulo; si sale con Esc, en esa copa no se le vuelve a poner. |
| **Difuminado del fondo** (`backdrop-filter`) | Un efecto de estilo que muestra borroso lo que hay detrás de un elemento (la cabecera «de vidrio» del modo inmersivo, el botón del chat). Encima del juego es caro: el navegador tiene que volver a difuminar la imagen del juego en cada cuadro. Como poner un filtro que hay que recalcular con cada muestra de la señal. |
| **Precarga del vestíbulo** | Mientras se conversa en el vestíbulo, un marco escondido abre la página del juego con `?precarga=1`: baja el programa y lo que el juego lee al arrancar y en la primera carrera, y lo deja guardado en el navegador **sin arrancar el juego**. Como cargar el condensador antes de cerrar el interruptor: cuando se aprieta «¡A correr!» la energía ya está. |
| **Presencia (del buzón)** | Lo que cada piloto deja escrito en el buzón de la sala (Firebase: `vivo/<sala>/rtc/en/<uid>`, hasta 16 letras): durante la carrera, la sesión de su malla; en el vestíbulo, cómo va su precarga («~40», «~listo»). La «~» del principio le dice a la malla que eso no es una sesión. |
| **MiiGroup (playerMiis)** | Una lista del juego con 12 lugares para Mii (SectionParams +0x188), uno por puesto de la carrera. El globo con el nombre sobre cada kart y las filas de las tablas escriben el nombre del Mii de ese lugar. El juego solo llena el lugar 0 (con la licencia: «Piloto»): por eso en la sala un humano salía «Piloto» y el otro sin nombre. |
| **Skin (de Retro Rewind)** | Otra apariencia de un personaje (otro modelo y otro nombre: «Meowser» es una de Bowser, «King Bob-omb» una de Wario). Retro Rewind sortea las de las CPU al empezar la copa; solo cambian lo que se ve. La página le pregunta al juego el nombre que usa para cada CPU en vez de adivinarlo por el personaje. |
| **UTF-16** | Una forma de guardar texto donde cada letra común ocupa 2 bytes. Los nombres de los Mii del juego son 10 letras UTF-16 y un 0 al final. La página quita lo que la letra del juego no puede escribir (emoji, caracteres de control) y corta en 10. |
| **Cartel (de quien recargó)** | Una tarjeta arriba de la imagen para quien recargó la página con la copa andando: «Carrera 2 de 4 en curso · Vuelves en la 3. Mientras, si quieres, elige personaje y vehículo». Antes era una píldora al centro que tapaba una pantalla de personajes que sí sirve. |
| **Volver a elegir (en el descanso)** | El botón opcional «Cambiar personaje y vehículo» del zócalo: abre la pantalla de personajes del juego por código; lo elegido corre desde la carrera siguiente, igual en todas las consolas. Si el descanso termina antes de confirmar, se corre con lo de antes. |
| **Modo elección** | Una marca del gancho de la pantalla de personajes (`g_eleccion`, `directo_nativo.cpp`): mientras está puesta, al confirmar el derrape el juego no sigue a elegir pista, solo avisa a la página lo elegido. El salto a la pantalla de personajes del descanso la apagaba (§98.4): el juego seguía solo a otra carrera. |

### La red según el crítico, la carga de la sala y los niveles de CPU de más arriba (§99)

| Término | Qué es y qué hace |
|---|---|
| **Preparación de la sala** | Lo que pasa entre abrir la sala y que el navegador quede listo para jugar sin trabarse: bajar el juego, arrancarlo, compilar los ~700 pipelines de la lista y llegar a la primera pantalla. La sala espera detrás de una cortina con **barra de progreso** y recién después la anfitriona ve la lista de copas. Como esperar a que un motor llegue a régimen antes de cargarlo. |
| **Tarea larga** (*long task*) | Un trabajo de la página que ocupa el único hilo 50 ms o más: mientras dura, la página no responde (la lista de copas se traba). El navegador avisa de cada una (`PerformanceObserver`); la preparación espera **un segundo entero sin ninguna** («calma»). |
| **Cola de UDP** | Lo que la malla deja juntarse esperando salir por el canal rápido antes de tirar paquetes viejos. En la sala, 8 KB: más cola solo es más atraso (botones viejos que ya no sirven). Como un búfer chico en un lazo de control: mejor perder una muestra vieja que actuar con atraso. |
| **ICE restart / reenganche** | Volver a negociar el camino de una conexión WebRTC que tambalea sin tirarla (otra oferta con `iceRestart`). Antes, una conexión que se caía 2 s se daba por muerta. |
| **TURN** | Un servidor que **retransmite** los paquetes cuando dos PC no pueden hablarse directo (redes con NAT estricto). El Worker del sitio entrega uno (`/turn`); la sala se lo pasa al juego. Como un repetidor: más lento que el enlace directo, pero llega. |
| **Toma del anfitrión** | Si el anfitrión desaparece del buzón de la sala más de 15 s con la copa andando, todas las páginas eligen al mismo reemplazo (el primero de la copa que sigue presente) y ese anota `{t:"toma"}` en la sala: así puede cerrar la copa y guardar la tabla. |
| **Reloj común (estilo NTP)** | Saber la hora de la anfitriona con pocos ms de error: cada latido lleva mi hora, la anfitriona contesta con la suya, y con la ida y vuelta medida se descuenta lo que tardó el mensaje (de las últimas 8, la más rápida). Como sincronizar dos relojes con un pulso de ida y otro de vuelta. |
| **Largada pareja** | Que todos vean la cuenta regresiva a la vez y el turbo de salida pida la misma anticipación a todos: el último en cargar espera media ida y vuelta antes del cuadro 0; en la cuenta, todos con al menos 6 cuadros de retraso; y al que no carga, cuando ya cargó la mitad, se lo espera a lo más 15 s. |
| **Autoridad por estabilidad** | El papel de autoridad (§80) ya no va al primero de la lista sino al más estable: el que manda a tiempo, **no va atrás** de los demás (se traba) y no tiene la red claramente peor (su ida y vuelta típica viaja en su informe). Entre carreras, la anfitriona elige como primera autoridad al que tuvo menos ratos malos. Como poner de maestro de reloj al oscilador más estable de la red. |
| **Ponerse al día** | Mario Kart Wii no recupera los cuadros que se atrasó: si un cuadro tarda, el siguiente va a su hora y la consola queda atrás para siempre. Ahora, cuando una PC se traba (o va atrás de la mayoría), le pide al programa que corra seguidos, **sin esperar la hora de cada uno**, los cuadros que le faltan (dibujándolos todos: así la carrera sigue igual en todas). Como un motor paso a paso que perdió pasos y los recupera con una ráfaga. |
| **Grilla del retrace** | La «hora» de cada cuadro: el programa espera el retrace (el pulso de 60 Hz de la tele de la Wii) para empezar el siguiente. Para ponerse al día, la grilla se corre para atrás lo que iba a esperar (`mkw_prisa`, en el runtime: va como parche). |
| **Relevo rápido (pausa)** | Al que se calla (pestaña trabada o red cortada) se lo **pausa** a los ~150 ms en vez de esperarlo 2 s: desde un cuadro que deciden todos igual, su kart va con un botón calculado igual en todas las PC (acelerar si iba acelerando y el volante soltándose), nadie lo espera, y cuando vuelve pide «vuelvo desde el cuadro r» y maneja otra vez. Si en 20 s no volvió, la pausa pasa a ser el corte de siempre. Como un interruptor de transferencia: si una fuente se cae, la carga pasa a la de respaldo sin cortar, y vuelve cuando la principal está estable. |
| **Botón calculado (de la pausa)** | El que usa el kart del pausado: el último que se usó para él antes de la pausa, con el acelerador y el volante que se va soltando en 60 cuadros. Depende solo de ese botón y de cuántos cuadros pasaron: es el mismo en todas las consolas. |
| **Marca «pausa en camino»** | Un bit en cada paquete de botones que le mando a alguien mientras hay una pausa suya propuesta o abierta. Si le llega antes que el aviso de la pausa (van por canales distintos), se queda quieto en el cuadro que ya corrió hasta saberla: si siguiera con sus botones más allá, su copia de la carrera se separaría. |
| **Callado** | Del que no llega **nada** (ni pings ni paquetes) hace más de 150 ms. Solo al callado se lo pausa; al que se le pierden paquetes pero se lo sigue oyendo se le piden de nuevo. |
| **Hard AI (de Retro Rewind)** | El ajuste de RR que cambia una sola cosa: la tabla de velocidad de la IA (`kartAISpdParamRR.bin`). Con ella la CPU quiere ir a 170 a 150cc y va siempre pegada al tope de 120. Es el nivel **Intenso** de la página. |
| **Tope duro (de velocidad)** | Un número de cada kart (`Kart::Movement +0x2C`) que corta la velocidad del motor y la de la física: 120 a 150cc. Como el limitador de corriente de una fuente: cada kart tiene el suyo. **Imposible** se lo sube solo a las CPU (138). |
| **Límite blando** | El techo de velocidad de cada cuadro (+0x18): sube de golpe y baja de a 3 por cuadro; nunca pasa del tope duro. |
| **Estadísticas del kart (copia)** | La suma de vehículo + personaje (velocidad base, aceleraciones, giro, derrape, miniturbo) que el juego arma **para cada kart** al crearlo y lee en cada cuadro. Imposible le multiplica las de las CPU al crearlas: no toca a nadie más. |
| **Hoja copiada en línea** | Una función chica que el traductor pegó adentro de quien la llama en vez de llamarla. Envolverla no sirve (nadie la llama): por eso el tope de las CPU se vuelve a subir cada cuadro, en la función que corre siempre. |
| **Zona muerta (del VR)** | Si el VR fijo de una CPU está 6599 o más por encima del tuyo, perder contra ella no te cuesta nada en la curva del juego; desde §99, ganarle tampoco paga. Como la banda muerta de un comparador: dentro, el lazo no actúa. Antes era una «lotería»: perder 0, ganar hasta 112 × peso. |
| **Fuera de escala** | Un nivel de CPU al que una persona de 5000 le gana menos del ~1,3 % de las veces (Intenso, Imposible). Contra él un VR fijo no mide nada: sería un **imán** que lleva a todos al mismo VR. Es un instrumento saturado. |
| **Segunda llegada** | En Intenso e Imposible, la comparación extra entre cada par de humanos: gana quien le ganó a más CPU (empate = nada), con la curva del juego (a igual VR, 16 en Intenso y 24 en Imposible). Lo que gana uno lo pierde el otro. Es una **medición diferencial**: lo que les pasa a todos (perder contra la CPU) se cancela —rechazo del modo común— y solo cuenta la diferencia. |
| **Ausente** | Quien no toca un botón 30 s seguidos en el primer minuto de la carrera (la regla del juego en línea). Para el VR cuenta como cortado: sin esto, una cuenta alterna quieta juntaba VR. Como un sensor desconectado: no da medida. Desde §100.8, lo que pasa después de cruzar la meta no cuenta (el juego ya no le pide botones). |
| **Fusible (del VR)** | La parte de las CPU de una carrera no pasa de ±112 (el par humano más grande), para que una lectura mala no mueva el VR de golpe. |
| **Ancla neutral** | El VR fijo de un nivel con el que las carreras ya jugadas no habrían creado ni quitado VR en total. Sirve para recalibrar con carreras de verdad (`anclaNeutral`). Como calibrar el cero de un instrumento hasta que la corriente neta sea cero. |

### Desconexiones, pedir copa, los mandos del sitio y la prueba de conexión (§100)

| Término | Qué es y qué hace |
|---|---|
| **Anfitriona provisoria** | La página que toma el mando de la sala cuando la anfitriona deja de oírse (4 s si además «se fue», 10 s si solo se calló): la primera de la sala, en su orden, que sigue y se oye. Todas hacen la misma cuenta y eligen a la misma sin hablarse. Si la oficial (la que nombró el sitio) vuelve, le devuelven el mando. Como un relé maestro con respaldo: si el maestro deja de dar señal, manda el siguiente de la lista. |
| **«Se fue»** | Que una página ya no está en el buzón de la sala **y** su conexión directa no está sana: cerró la pestaña o perdió internet. A esa no se la espera (la sala la reemplaza a los 4 s, la carrera la corta en 1 s); a la que solo se calló se la espera, porque puede volver. |
| **`pagehide`** | El aviso que da el navegador cuando se cierra o se deja una página. La sala lo usa para salir del buzón en el momento, en vez de esperar a que Firebase note el corte. |
| **Pestaña congelada** | Una página que el navegador dejó sin correr unos segundos (trabada, o la PC durmió). Al volver, su reloj dio un salto: ese primer tic no cuenta para reemplazar a nadie, porque lo que le mandaron todavía espera en la cola. |
| **Banco de desconexiones** | `prueba-desconexion.mjs`: 11 casos con el juego de verdad (quién se va, cuándo y cómo) y lo que tiene que pasar en cada uno. Como una batería de ensayos de falla de un tablero: abrir cada interruptor en cada momento y ver que el resto sigue andando. |
| **Reenvío por otro (H1.4)** | Si dos pilotos no se hablan directo pero los dos hablan con un tercero, los mensajes de la sala dan un salto por ese tercero (`{t:'via'}`, uno solo). Como una estación repetidora de radio. Desde la prueba de conexión, también el latido del que no oye a la anfitriona (si no, ella lo daba por ausente). |
| **Reparto por cambio (H9)** | El estado entero de la sala va solo cuando cambia, más un refresco cada 5 s por si se perdió algo; cada latido dice qué versión tiene cada uno, y al atrasado se le manda en el momento. Antes iba entero cada segundo. Como pasar de muestrear siempre a muestrear por evento, con un refresco lento de seguridad. |
| **Pedir copa** | El botón de los demás pilotos mientras la anfitriona elige la copa: abre el mismo selector y manda «pido la copa N». Ella ve quién pide cuál (🙋) y, si se le acaba el reloj, sale la más pedida. |
| **Copa más pedida** | La que más pilotos piden; si empatan, la del que está más arriba en la sala. Si nadie pidió, una al azar (como antes). |
| **`mando.js` del sitio** | El archivo de Juegos que maneja los mandos en todas sus páginas: los detecta, avisa cuál se conectó con sus botones dibujados y, si ningún juego lo configura, mueve un **cursor** por la página (el stick mueve, A hace clic). |
| **Modo cursor / modo juego** | Los dos estados de `mando.js`: en un menú de la página, el mando mueve el cursor; en el juego, no hace nada y el mando es del juego. Mario Kart le dice cuándo hay un menú suyo abierto; mientras el mando maneja el cursor, no llega al juego (`controles.sinMandos`). |
| **Marco hijo** | La página del juego dentro del marco (`iframe`) de Juegos. Si carga su propia copia de `mando.js`, la de la página de arriba se aparta mientras el marco se ve: así nunca manejan el mando las dos a la vez. Como un conmutador de transferencia: una sola fuente conectada. |
| **Prueba de conexión (H1.2)** | Lo que cada página mira cada 2 s de cada otro piloto: 🟢 conexión directa sana (con su ida y vuelta), 🛰 por el repetidor (TURN), 🔴 por otro piloto o sin conexión, ⏳ conectando. Va en la tira del vestíbulo del sitio, al lado de cada piloto. Como un probador de continuidad: un LED por cable. |
| **Ida y vuelta** (*round-trip time*) | Lo que tarda un mensaje en ir a otro navegador y volver la respuesta, en ms. WebRTC la mide sola (`getStats`, `currentRoundTripTime`). |
| **Histéresis (del aviso)** | La prueba de conexión vuelve a avisar al sitio por la ida y vuelta solo si se movió más de 10 ms desde la última que avisó: el ruido de pocos ms no hace parpadear el vestíbulo. Como un comparador con histéresis. |

### Afinar la red: la traba, la sincronía con ponerse al día y la cuenta de estabilidad (§101)

| Término | Qué es y qué hace |
|---|---|
| **Banderas del informe** | Tres «sí/no» en un byte de cada informe (el resumen que cada consola manda cada medio segundo): «este rato es dudoso», «sé ponerme al día yo sola» y «voy atrás / me estoy poniendo al día». Además de la medida, dicen en qué condición se tomó. Como los LED de estado de un variador al lado de la lectura de corriente. |
| **Voy atrás (atrasada)** | La consola que va más de 3 cuadros detrás de la mayoría, o que está corriendo la ráfaga para ponerse al día. Lo de los demás le llega «con holgura de sobra» porque ella lo necesita más tarde: esa holgura es su atraso, no mérito de los otros, y su rato cuenta como dudoso. Como medir el desfase de una señal con una sonda que tiene su propio retardo: lo que se ve no es de la señal. |
| **Traba propia (mientras espera)** | Si la pestaña se traba justo cuando estaba esperando los botones de otro, ese rato no fue «esperar al otro»: fue un tirón suyo. Se nota porque la revisión que corre cada 40 ms durante la espera tuvo un hueco de más de 100 ms. No se le carga al otro, no cuenta para pausarlo ni cortarlo, y quien se trabó se pone al día. `?trabaPropia=0` = como antes. Como descontar de una medición de tiempo el rato en que el instrumento estuvo apagado. |
| **Bloqueo (de la pausa)** | Mientras se decide pausar a alguien (en dos fases: uno propone, los demás contestan hasta qué cuadro tienen lo suyo, y recién ahí se decide), nadie corre ese cuadro. Es lo que cuesta una traba de 1,5 s a los demás: unos 65 ms (la respuesta de C, que viaja por su red mala). En el registro sale como «faltan [-1]». |
| **Cuenta de estabilidad (ratos malos)** | Lo que la sala suma de cada consola al terminar una carrera para elegir la primera autoridad de la siguiente: los ratos en que la mayoría la vio tarde, los que fue atrás y su ida y vuelta (cada 10 ms cuenta como un rato malo). Menos = más estable. Es `ratosMalos` de `sala-carrera.mjs`: la misma función la usan la sala y el banco. |

### Listo para el PR y la PC justa (§102)

| Término | Qué es y qué hace |
|---|---|
| **Conflicto (de merge)** | Al juntar dos ramas, un lugar del mismo archivo que las dos cambiaron distinto (aquí, casi siempre una lista donde cada rama agregó su juego al final). Git no elige: se resuelve a mano, normalmente dejando las dos cosas. Como dos revisiones del mismo plano que tocaron la misma bornera. |
| **Archivo sellado** | Los archivos del sitio que llevan su versión en el nombre del pedido (`juegos-app.js?v=…`), para que el navegador no use una copia vieja. El sello lo pone el script de publicar; al juntar ramas se dejan los de `main` y se vuelven a sellar al publicar. |
| **Marca `@controles:`** | Una línea en la cabecera de un archivo del juego que dice qué pide para jugar («teclado», «teclado y ratón»). El script `build-controles.js` del sitio las junta en `controles-datos.js` y el Salón las muestra. Es la placa de características del equipo. |
| **PC justa** | Una PC que corre el juego a 60 pero sin margen (15 de los 16,7 ms de cada cuadro trabajando): cada cuadro largo suelto la deja atrás, y la ráfaga para ponerse al día no corre más rápido que el reloj. Como un motor a plena carga: sigue la velocidad, pero no tiene par de sobra para recuperar un tirón. |
| **Ponerse al día de verdad (alcance)** | Desde §102, una consola que va atrás solo dice «sé ponerme al día» si en los últimos 3 ratos corrió al menos un 4 % más cuadros que los del tiempo en que corrió. Si no, los demás se frenan un poco por ella. Como un lazo de control rápido que avisa cuando su actuador se satura, para que actúe el lazo lento. `?alcance=0` = como en §101. |

### «🛰 Todo por Cloudflare» (§103)

| Término | Qué es y qué hace |
|---|---|
| **Repetidor forzado (`iceTransportPolicy: 'relay'`)** | Una opción de WebRTC que le dice al navegador: «junta solo caminos por el repetidor TURN, ninguno directo». Así todos los paquetes pasan por Cloudflare aunque los dos navegadores pudieran hablarse directo. Como obligar a que una llamada pase por la central aunque los dos teléfonos estén en la misma pieza. |
| **Candidato «relay» (del repetidor)** | Una dirección para llegar a un navegador que no es suya: es un puerto que el repetidor abrió para él. Si los dos extremos de una conexión son «relay», todo va por el repetidor. `malla.camino(u)` lo dice (`local`/`remoto`). |
| **Asignación (TURN Allocate)** | Lo que el repetidor le presta a cada navegador: un puerto UDP propio desde donde reenvía lo suyo y donde recibe lo de los otros. Dura lo que el navegador la renueve (Refresh). Como una línea alquilada en la central. |
| **Credenciales TURN** | El usuario y la contraseña que pide el repetidor para dar una asignación. Las de Cloudflare las entrega el Worker de amigos en `/turn` (vencen solas); cada mensaje va firmado con ellas (HMAC-SHA1). |
| **Repetidor de mentira (`turn-local.mjs`)** | Un servidor TURN propio de este PC, solo para las pruebas: hace lo mismo que el de Cloudflare sin salir a internet. Nunca se publica. |
| **Reserva automática (del repetidor)** | Lo que hacía la sala desde §99 y se quitó en §103b: el repetidor quedaba «enchufado» en todas las conexiones y WebRTC lo usaba solo si nada directo funcionaba. Ahora, como en BT3, el repetidor es solo el modo que prende el anfitrión. Como pasar de una transferencia automática a la red de respaldo a una manual. |
| **SCTP (juntar mensajes)** | El protocolo que lleva los mensajes de los canales de datos de WebRTC. Si hay varios mensajes chicos esperando, los mete en un mismo paquete UDP: por eso 200 mensajes no son 200 paquetes. Como juntar varias cartas en un mismo sobre. |

### Menos llamadas al Worker (§104)

| Término | Qué es y qué hace |
|---|---|
| **Llamada (al Worker)** | Cada vez que el navegador le pide algo al Worker de amigos: un pedazo del disco, el manifiesto, una pregunta previa… El plan gratis de Cloudflare da **100.000 al día** para toda la cuenta (también para BT3), y cuenta llamadas, no megas: una de 16 MB cuesta lo mismo que una de 1 KB. Como un plan de teléfono con N llamadas al mes, sin importar cuánto dure cada una. |
| **Lote** | Una sola llamada (`POST /mkw/lote`) que trae muchos pedazos de varios archivos a la vez, pegados uno detrás del otro. El cuerpo del pedido dice cuáles (`{"p": [[ruta, inicio, fin], …]}`) y la página corta la respuesta porque ya sabe cuánto mide cada uno. Como mandar todas las cartas del día en un solo sobre certificado. |
| **Cartero de lotes (`lote.mjs`)** | La parte de la página que junta los pedazos pedidos más o menos a la vez y los manda en un lote: lo urgente (el juego esperando) sale en seguida y primero; lo demás espera 8 ms para juntarse; con todas las llamadas ocupadas (4 a la vez), lo que llega se sigue juntando. |
| **`cache: 'no-store'` (en el pedido)** | Una opción del pedido que le dice al navegador «no uses tu caché HTTP». Chrome, con ella, tampoco usa lo que recordaba de la pregunta previa: preguntaba otra vez antes de CADA pedazo (696 preguntas en una visita). El lote, como es POST, no la necesita. |
| **Histéresis (del adelanto)** | La lectura seguida de un video ya no pide un bloque cada vez que avanza un bloque: mientras queden 4 MB por delante no pide nada, y cuando baja de eso rellena 8 MB de una vez. Como un termostato con banda muerta: no prende y apaga el calefactor cada décima de grado. |
| **Operaciones por llamada** | Lo que el Worker gratis puede hacer dentro de UNA llamada: 50 operaciones de R2 y de la caché de Cloudflare (juntas), con 6 esperando a la vez. Cada pedazo de un lote gasta hasta 3 (mirar la caché, leer de R2, guardar en la caché): por eso un lote lleva como mucho 12. |
| **`tee` (de un flujo)** | Partir un flujo de bytes en dos copias que avanzan juntas: una va a la página y la otra se guarda en la caché de Cloudflare, sin copiar el pedazo entero en la memoria del Worker (gasta menos de sus 10 ms de procesador). Como una derivación en T en una cañería. |

### Mario Kart en su propio bucket (§105)

| Término | Qué es y qué hace |
|---|---|
| **Enlace (binding) del Worker** | El nombre con que el código del Worker ve un recurso de Cloudflare: `env.DISCO` es el bucket de la ISO de BT3 y, desde §105, `env.MKW` el de Mario Kart. Se conecta en el panel (Settings → Bindings), no en el código: el mismo archivo sirve para cualquier bucket. Como la bornera de un tablero: el equipo dice «entrada 1», y en la instalación se decide qué cable llega ahí. |
| **Respaldo del enlace** | Si el Worker no tiene el enlace `MKW`, Mario Kart se busca en `DISCO`, como antes de §105 (`mkwR2 = env => env.MKW \|\| env.DISCO`). Así un Worker pegado antes de crear el bucket no se cae: dice «no está subido». |

## 2026-10-16 · Día 1

(Cada sección lleva la hora local en que se hizo.)

### 1. Análisis de los proyectos · 17:20–17:35

**Qué:** leer WiiCompiled, WheelWizard, la wiki de Retro Rewind y el kit de BT3 para decidir si el port es posible.

**Cómo:** clones de solo lectura de los dos repos (`git clone --depth 1`), y dos análisis en paralelo: uno del
runtime de WiiCompiled pensando en WebAssembly y otro de WheelWizard pensando en qué sirve para una web.

**Resultado:** `docs/analisis.md`. En corto:
- El código que genera WiiCompiled es C++ muy "limpio" (sin asm, sin trucos del procesador): compila a wasm.
- Lo difícil: los hilos del juego (fibers), el renderizador sobre Dawn nativo con esperas a la GPU, el online
  (sockets UDP que el navegador no tiene) y lo legal (el `.wasm` es código de Nintendo traducido → nunca público).
- WheelWizard no tiene nada del motor: sirve como referencia de formatos (partidas, friend codes, Miis, salas).

### 2. Decisiones del dueño · 17:35–18:05

| Decisión | Por qué |
|---|---|
| El producto es **MKW con Retro Rewind instalado** | Es lo que se quiere jugar con los amigos |
| **60 fps** | Es la velocidad nativa de Mario Kart Wii (la física avanza a 60 cuadros por segundo) |
| **WebGPU** en vez de WebGL2 | aurora (el renderizador de WiiCompiled) ya está escrito para WebGPU |
| Todo en `C:\Users\zilon\Desktop\Gaming\MKW RETRO` | Un solo lugar para todo |
| Teclado, mandos y celular | Que se pueda jugar en cualquier lado |
| Simular y probar todo en un banco (tipo artifacts) | Como el banco de BT3: nada se da por bueno sin su prueba |
| Documentar qué se hizo y cómo | Esta bitácora |

### 3. El proyecto · 17:40

**Qué:** repositorio git en la carpeta del proyecto, con un `.gitignore` que impide que entre cualquier cosa del
juego.

**Cómo:**
```bash
git init -b main
```
El `.gitignore` excluye: la imagen (`*.rvz`, `*.iso`…), lo extraído (`extraido/`, `*.dol`, `*.rel`, `*.szs`),
Retro Rewind, el C++ generado, las compilaciones (`*.wasm`) y los repos de terceros (`terceros/`).
Comprobación: `git status` solo muestra nuestros archivos (la carpeta del disco no aparece).

Archivos creados: `CLAUDE.md` (reglas y decisiones), `PLAN.md` (el plan por fases), `docs/analisis.md`,
`herramientas/versiones.md` (commits y versiones fijadas), esta bitácora.

### 4. El PC de trabajo · 17:41

Revisado con PowerShell (`Get-Command`, `Get-CimInstance`): Windows 11, Ryzen 7 9800X3D (8 núcleos/16 hilos),
61,6 GB de RAM, RTX 3080 Ti, 1,6 TB libres. Ya había: git, Node 24, .NET SDK 10, CMake + Ninja, Python 3.12.
Falta para compilar a la web: **Emscripten**. WSL no tiene distribución, pero **no hace falta**: el traductor
corre en Windows y Emscripten también.

### 5. Los repos de terceros, con commit fijo · 17:42

```bash
git clone … terceros/Wiicompiled     # @ bd219e38 (2026-10-09)
git clone … terceros/WheelWizard     # @ b721766  (2026-10-16)
```
Igual que BT3 fija el commit del fork: un commit fijo + nuestros parches = un resultado que se puede repetir.

### 6. El traductor de WiiCompiled · 17:44

**Qué es:** un programa en C# que lee el ejecutable de la Wii (`main.dol`, instrucciones PowerPC) y escribe C++
equivalente, función por función.

**Cómo:**
```bash
dotnet build terceros/Wiicompiled/translator/Translator.sln -c Release     # 12 s, 0 avisos, 0 errores
DOTNET_ROLL_FORWARD=Major dotnet test … --no-build                          # 643 de 643 pruebas bien
```
`DOTNET_ROLL_FORWARD=Major` deja que un programa hecho para .NET 8 corra en el .NET 10 que ya estaba instalado
(así no hubo que instalar otro .NET).

### 7. El disco · 17:45

**Revisión de la cabecera** (sin tocar el archivo, leyendo sus primeros 216 bytes con PowerShell):
RVZ v1, zstd nivel 19, Wii, **`RMCP01`** (PAL), revisión 0, 4,38 GiB sin comprimir. Es la única versión que
acepta WiiCompiled.

**Extracción** con `nodtool` 2.0.0-alpha.10 (la misma herramienta y versión que usa el setup de WiiCompiled,
bajada de los releases de `encounter/nod` a `herramientas/cache/`):
```bash
nodtool info    <disco.rvz>                      # 3 particiones: Update, Data (RMCP01, 3,96 GiB), Channel
nodtool extract <disco.rvz> extraido/disco -q    # 2,6 GB, 2 032 archivos
```
Un disco de Wii está **cifrado**; nodtool lo descifra y deja los archivos normales (`sys/main.dol`,
`files/rel/StaticR.rel`, `files/Race/Course/*.szs`…).

**Verificación** (lo que hace que el juego traducido sea exacto):
```
sha256 sys/main.dol         = 80d18895…5b05   ✓ igual a recomp.yml
sha256 files/rel/StaticR.rel = 16d9d146…f67d   ✓ igual a recomp.yml
```

### 8. Retro Rewind · 17:47

**De dónde:** el servidor oficial de actualizaciones (el mismo que usa WheelWizard):
```
https://update.rwfc.net/RetroRewind/RetroRewindInstall.txt   → …/zip/6.13.0-full.zip  (1,9 GB)
https://update.rwfc.net/RetroRewind/RetroRewindVersion.txt   → la última es 6.13.1    (delta de 29 MB)
```
**Instalación** (igual que WheelWizard): descomprimir el zip completo, quedarse con `RetroRewind6/` y
`riivolution/`, y descomprimir encima el delta 6.13.1. Resultado: `terceros/RetroRewind/RetroRewind6/` (2,1 GB),
`version.txt` = `6.13.1`, `Binaries/Code.pul` (el código del mod) con SHA-256 `7471e1d2…b4a3`.

### 9. La traducción: de PowerPC a C++ · 17:46–17:49

Cinco comandos del traductor, en el mismo orden que el setup oficial (`Launcher/LocalBuild.ps1`). Quedaron en
un script reproducible: **`herramientas/traducir.ps1`** (comentado línea por línea).

| Paso | Comando | Resultado |
|---|---|---|
| Juego base | `translate-recursive 0x800060A4` | **29 637 funciones**, 7,7 millones de líneas, 269 MB de C++, en 37 s |
| Manifiesto | `emit-base-manifest` | 26 277 rangos de funciones, 18 secciones |
| Retro Rewind | `translate-mod --profile retro-rewind` | 10 611 parches, 3 144 funciones del mod, 331 parches de datos, payload de Retro WFC |
| Datos | `generate-data-init` | 7,34 MB de secciones del DOL/REL (se embeben: otra razón para no publicar) |
| Compilación | `emit-build-shards` | 96 shards base + 48 del mod, grafo `shards.cmake` |

**Trampa encontrada:** la primera vez `translate-mod` se negó: *"the base translation was produced without
awareness of this mod's Code.pul"*. El juego base se traduce con optimizaciones (meter funciones chicas dentro
de otras) que pueden saltarse los parches del mod. Solución: el traductor busca el `Code.pul` en la ruta del
perfil (`PulsarPacks/completed/RetroRewind/RetroRewind6/`); ahí se puso un **enlace** (junction) a la carpeta de
Retro Rewind, se retradujo el base (566 archivos cambiaron) y el mod pasó.

**Dónde quedó todo** (fuera de git): `terceros/Wiicompiled/generated/` (C++ del juego, datos, shards) y
`terceros/Wiicompiled/build/mods/retro_rewind_full_cpp/` (C++ del mod).

### 10. Emscripten · 17:52

**Qué:** el compilador de C/C++ a WebAssembly (el mismo de BT3, versión 6.0.12).
```bash
git clone https://github.com/emscripten-core/emsdk.git herramientas/emsdk
herramientas/emsdk/emsdk.bat install latest     # 6.0.12
herramientas/emsdk/emsdk.bat activate latest
```
En Windows nativo, sin WSL. En PowerShell se carga con `. herramientas\emsdk\emsdk_env.ps1` (con
`$env:EMSDK_QUIET='1'` y **antes** de `$ErrorActionPreference='Stop'`, porque escribe avisos en stderr).

### 11. El banco de pruebas · 17:53–17:56

**Qué:** como el banco de BT3, un sitio local con páginas de prueba sueltas. Cada una muestra en pantalla qué
verificó (✓/✗), escribe lo mismo en la consola (para Playwright) y guarda el resumen para el índice.

| Archivo | Qué es |
|---|---|
| `banco/servir.cjs` | Servidor sin dependencias (puerto 8130). Manda COOP/COEP (página aislada → SharedArrayBuffer) y `application/wasm` |
| `banco/comun.js` | `prueba(id, título)` → `ok(nombre, condición, detalle)`, `nota()`, `fin()` |
| `banco/estilo.css` | Estilo común (oscuro/claro según el sistema) |
| `banco/index.html` | Índice: cada prueba con su último resultado |
| `banco/pruebas/capacidades.html` | ¿Este navegador puede correr el juego? JSPI, WebGPU (+WGSL), memoria de 2 GB, excepciones de wasm, 60 Hz, mandos, táctil, inclinación, OPFS |
| `.claude/launch.json` | Para abrir el banco en el navegador del panel (`banco`) |

Resultado en el PC (Chrome del panel): **capacidades 14 bien, 0 mal** — RTX 3080 Ti como `nvidia ampere`,
WebGPU con texturas BC, límites de 2 GB por búfer.

**Trampa:** medir los Hz de la pantalla con `requestAnimationFrame` se queda esperando para siempre si la
pestaña está oculta (el navegador no dibuja). Ahora se rinde a los 2 s y lo dice.

### 12. Prueba de concepto: los hilos del juego (fibers) sobre JSPI · 17:55

**El problema:** Mario Kart Wii tiene varios hilos (OSThread) que se pasan el turno. WiiCompiled los hace con
fibers (cambiar de pila: `CreateFiber` en Windows, libco en Linux). El navegador no deja cambiar de pila a mano.

**Lo que se descubrió:** en Emscripten 6.0.12, `emscripten_fiber_swap` solo existe con **Asyncify**
(`src/lib/libasync.js`: usa `_asyncify_start_unwind`). Asyncify reescribe cada función que pueda llegar a un
cambio de hilo: en el juego serían casi todas (~33 000): mucho más grande y lento. No sirve.

**La solución probada:** fibers hechos a mano sobre JSPI (`banco/pruebas/fibers/fibers.c`):
- Cada fiber es **una llamada a wasm distinta** a `fiber_trampolin`, exportada como "promising" con
  `-sJSPI_EXPORTS`. JSPI le da a cada una su propia pila de wasm.
- Pasar el turno = `fiber_cambia(otro)`, una función `EM_ASYNC_JS`: guarda el puntero de la pila de C del fiber
  actual (`stackSave`), crea una promesa que lo despertará, y en un microtask (cuando ya está suspendido) pone la
  pila de C del otro (`_emscripten_stack_set_limits` + `stackRestore`) y lo arranca o lo despierta.
- Cada fiber tiene **su propia pila de C** (malloc de 256 KB), igual que `finishContextSwitch` de Emscripten.

```powershell
banco\pruebas\fibers\construir.ps1                                     # emcc -O2 -sJSPI ...
node --experimental-wasm-jspi banco\pruebas\fibers\prueba-node.mjs     # en Node
# y en el navegador: http://localhost:8130/pruebas/fibers/
```

**Resultado (Node y Chrome):**
- ✓ el orden de los turnos sale exacto (`MABCcab31m2no`)
- ✓ cada pila de C sobrevive a los cambios (recursión de 16 niveles con arreglos locales, cambiando de fiber
  en el nivel 8: las tres sumas dan 136)
- ✓ un fiber puede esperar algo asíncrono (30 ms) en medio de todo
- ✓ **un cambio cuesta 0,26 µs en Node y 0,72 µs en Chrome** (1,4 a 3,9 millones por segundo). El juego cambia de
  hilo decenas de veces por cuadro, y un cuadro a 60 fps tiene 16 700 µs: sobra.

**Trampas:** hubo que exportar `emscripten_stack_set_limits` (no viene por defecto) y declarar como "promising"
**toda** función exportada que pueda terminar cambiando de fiber (`mide_cambios`), si no: *"trying to suspend
without WebAssembly.promising"*.

**Conclusión:** el bloqueador 13 (hilos del juego sin Asyncify) **tiene solución**. Falta probar que una
excepción C++ (el runtime lanza `AccessViolation`) no cruce mal de un fiber a otro (→ sección 14: no cruza).

### 13. Prueba de concepto: WebGPU desde C++ (emdawnwebgpu) · 18:00

**El problema:** aurora (la capa de gráficos de WiiCompiled: GX de la Wii → WebGPU) usa Dawn nativo y espera a la
GPU con `Instance::WaitAny`, una espera que bloquea. En el navegador no se puede bloquear el hilo principal.

**La prueba** (`banco/pruebas/webgpu/webgpu.cpp`, `em++ --use-port=emdawnwebgpu -sJSPI`): crea instancia con
`TimedWaitAny`, pide adaptador y dispositivo con `WaitAny` (JSPI suspende el wasm mientras el navegador
contesta), dibuja en el canvas y además en una textura de 64×64 que hace de "EFB" (el framebuffer de la Wii,
que el juego a veces lee de vuelta), la copia a un búfer, `MapAsync` + `WaitAny`, y revisa el color del centro.
Así 180 cuadros, cediendo al navegador entre cuadro y cuadro (`requestAnimationFrame`).

**Resultado (Chrome del panel, RTX 3080 Ti):** 10 bien, 0 mal. Color exacto (228, 0, 43) en los 180 cuadros;
**lectura de vuelta 3,2 ms de promedio**; 234,9 fps porque el monitor es de 240 Hz.

**Lecciones:**
- El juego tiene que **marcar su propio ritmo de 60 fps**: `requestAnimationFrame` va a la frecuencia del
  monitor (240 Hz aquí). Hay que contar tiempo y saltarse los cuadros sobrantes.
- La lectura de la EFB cuesta ~3 ms: usarla solo cuando el juego de verdad la pida.
- **Trampa:** con la pestaña del panel en segundo plano no llega `requestAnimationFrame` y la prueba "no mide".
  Hubo que traer la pestaña al frente. La prueba ahora cae a `setTimeout` si está oculta.

### 14. Pruebas de concepto: FMA exacta y excepciones entre fibers · 18:04

**FMA** (`banco/pruebas/fma/`): la Wii tiene multiplicar-y-sumar con un solo redondeo (`fmadd`, `ps_madd`) y la
física depende de que sea exacto. wasm no tiene esa instrucción: `std::fma` cae en la de software de musl,
exacta pero lenta. Dos versiones propias:
- **float**: el producto de dos float cabe exacto en un double; la suma se hace en double recuperando el error
  (TwoSum) y se "redondea a impar"; bajar a float da el resultado correcto (teorema de Boldo y Melquiond).
- **double**: producto partido sin error (Dekker), tres piezas sumadas sin error (TwoSum), redondeo a impar y un
  solo redondeo final. Exponentes extremos → musl.

Resultado: **90 millones de casos idénticos a musl** (40 M double, 10 M empates fabricados, 40 M float), 5/0.
Double: 9,3 ns (musl) → 5 ns; float: 3,2 → 2,5 ns. Compilado con `-ffp-contract=off` para que clang no "ayude".

**Excepciones** (`banco/pruebas/excepciones/`): el runtime lanza `AccessViolation` cuando el juego toca memoria
inválida. Con fibers sobre JSPI cada fiber es otra pila de wasm: ¿la excepción la atrapa el `try` correcto?
Se lanzan desde 21 niveles de profundidad, con otros fibers suspendidos dentro de su propio `try`, y desde un
fiber sin `try` (debe llegar a su trampolín, no al `try` de otro). Registro esperado y obtenido:
`A1 B1 B-atrapa:CC000004 A2 B2 trampolin2:CD000000 M1 A3 A-atrapa:CC008000 M-atrapa:DEAD0000` → 4/0.

**Trampas:** `stackSave is not defined` → hay que pedirlo con
`-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=["$stackSave","$stackRestore"]`. Y un error de diseño de la prueba (el
trampolín de B vuelve a main, no a A): main ahora le devuelve el turno a A.

### 15. Todo el C++ traducido compila a wasm · 18:14

**El parche** (`parches/runtime-web.diff`, aplicado en `terceros/Wiicompiled`): el código traducido incluye unas
pocas cabeceras del runtime que solo sabían de x86 y ARM. En vez de reescribir sus ~50 ramas por arquitectura,
wasm **toma las ramas de ARM** y se le da una imitación de las instrucciones NEON que usan:

| Archivo | Cambio |
|---|---|
| `isa/ppc_isa_wasm_neon.h` (nuevo) | Los ~35 intrínsecos NEON usados (`vfma_f32`, `vbsl_f32`, `vceq_f32`…) hechos con vectores genéricos de clang; `vfma_f32` con la FMA exacta; `MkwFma`/`MkwFms` (ver 16) |
| `isa/ppc_isa_config.h` | En wasm incluye la imitación en vez de `<arm_neon.h>` |
| `isa/ppc_isa_float.h`, `isa/ppc_isa_quantized.h` | `defined(__aarch64__)` → `(defined(__aarch64__) \|\| defined(__EMSCRIPTEN__))`; `std::fma` → `MkwFma`/`MkwFms` |
| `isa/ppc_isa_fpenv.h` | wasm no tiene registro de control de la FPU: el estado de NI (flush-to-zero) se guarda en una variable por hilo |
| `guest_flat_memory.h` | En wasm no hay "memoria plana" de 4 GiB ni protección de páginas: `RequiresCheckedAccess()` es constante `true`, así el camino plano desaparece al compilar y todo acceso va por la tabla de páginas |

¿Por qué ARM y no x86? Porque wasm, como ARM, no da los NaN de x86 (en wasm sus bits ni siquiera son
deterministas), y las ramas de ARM ya reescriben cada NaN a la respuesta de x86.

**Compilar** (`herramientas/compilar-shard.ps1`: genera un `build.ninja` y corre ninja con 16 hilos; mismas
banderas que `PublicProducts.cmake`, `-O2 -fno-fast-math -ffp-contract=off -fno-slp-vectorize`, más `-fwasm-exceptions`):

```powershell
powershell -ExecutionPolicy Bypass -File herramientas\compilar-shard.ps1 -Grupo base_common -Todos
```

| Grupo | Shards | Fuente | Objetos wasm | Tiempo |
|---|---|---|---|---|
| base_common | 72 | 165,8 MB | 80,0 MB | 47 s |
| retro_mod | 48 | 33,3 MB | 15,9 MB | 17 s |
| retro_portable_sensitive | 24 | 23,1 MB | 10,0 MB | 9 s |
| base_portable_sensitive | 24 | 23,1 MB | 9,8 MB | 9 s |
| registration (base / RR) | 16 + 16 | 4,7 + 5,3 MB | 3,8 + 4,4 MB | 2 + 2 s |
| dispatch (base / RR) | 1 + 1 | 3,0 + 3,3 MB | 1,4 + 1,6 MB | 2 + 2 s |

**202 shards, 0 errores.** El producto Retro Rewind (base_common + retro_*) enlazado de prueba, con todo exportado
y sin el runtime: **77,6 MB de wasm, 17,8 MB con gzip, 12,0 MB con brotli**. `WebAssembly.compile` en Node
tarda **70 ms** (V8 compila cada función recién cuando se usa). Quedan **105 funciones sin resolver**: las que el
código traducido le pide al runtime (`MemoryInline::Read32Slow`, `GetPersistentCpuContext`, registro de funciones,
WASI…) → es el trabajo de la fase 2. Lista en `build/shard/imports.txt`.

**Trampas:** en Git Bash no está `em++` (solo lo pone `emsdk_env.ps1`), y Windows PowerShell 5.1 no tiene
`ForEach-Object -Parallel`: por eso el script usa ninja, que además solo recompila lo que cambió (mira las
cabeceras). En emsdk el compilador es `em++.exe`, no `.bat`.

### 16. Paridad x86 ↔ wasm de la matemática del juego · 18:22

**La pregunta:** el build de PC (x86) coincide con la Wii bit a bit (WiiCompiled lo prueba con ghosts). ¿Nuestro
parche da los mismos bits?

**La prueba** (`banco/pruebas/paridad/`): `paridad.cpp` incluye las cabeceras **reales** del runtime y corre 22
operaciones (ps_mul/add/sub/div/madd/msub/neg, fmadd/fmsub/fnmadd/fnmsub, fmadds/fmsubs/fmuls, frsp con y sin NI,
fres, frsqrte, psq_l/psq_st) sobre 1 M casos reproducibles, con muchos raros (NaN con carga, SNaN, infinitos,
subnormales, ±0, extremos). Se compila dos veces: con g++ para x86 (`-march=x86-64-v3`, el perfil del build de
PC) → `referencia-x86.txt` con huellas FNV; y con em++ → la página compara huella por huella. Con dos o más NaN
ni x86 es determinista (depende del orden de operandos que elija el compilador): eso solo se informa.

**Primera corrida: 14/4.** Todas las ramas de pares (la imitación NEON) bien al primer intento; fallaban las 4
que usan `std::fma`. Volcando los casos: con un **SNaN en el sumando**, x86 lo devuelve silenciado
(`FFF4…` → `FFFC…`) y musl lo devuelve tal cual. Arreglo: `MkwFma` (en wasm, la FMA rápida de la sección 14 +
cada NaN reescrito a la respuesta de x86; en x86/ARM sigue siendo `std::fma`).

**Segunda: 17/1** (`fnmsub`). x86 compila `fma(a, c, -b)` como **una** instrucción `vfmsub`, así que un NaN en `b`
sale con su signo original; en wasm el `-b` volteaba el signo antes. Arreglo: `MkwFms(a, c, b)` = a·c − b, que
reporta el NaN de `b` sin voltear; lo usan fmsub, fnmsub y las formas `Subtract`.

**Final: 22/0 en Node y en Chrome** (1 M casos × 22 operaciones en ~270 ms). De paso, la FMA del juego en wasm
queda ~2× más rápida que la de musl.

**Lo que esta prueba NO cubre:** las sumas y multiplicaciones sueltas que el traductor escribe directo en C++
(`a + b`): en V8 sobre x86 dan los NaN de x86, pero en un celular ARM darían el NaN por defecto de ARM. Anotado
como riesgo 4 del plan.

```powershell
banco\pruebas\paridad\construir.ps1             # g++ (referencia) + em++
node banco\pruebas\paridad\prueba-node.mjs      # 22 bien, 0 mal
# y en el navegador: http://localhost:8130/pruebas/paridad/
```

**Conclusión: fase 1 terminada.** Hilos, excepciones, WebGPU, FMA, compilación completa y paridad numérica:
nada de lo que podía tumbar el proyecto lo tumbó. Lo que queda abierto es el rendimiento (fases 2-3) y el juego
en línea (fase 6).

---

## Fase 2 — el juego corriendo en Node, sin pantalla

**La meta:** que el juego completo (Mario Kart + Retro Rewind) arranque como programa wasm en Node y llegue a
correr cuadros, aunque todavía no dibuje nada. Es el equivalente a energizar una placa nueva sin el display
conectado y verificar por el puerto serie (el log) que el micro arranca y corre su lazo principal.

### 17. El mapa del runtime · 18:28

Antes de tocar nada, un agente (otro Claude trabajando en paralelo) recorrió todo el runtime de WiiCompiled
(~36 000 líneas) y devolvió un mapa. Lo importante:

- **Cómo arranca:** `main()` → lee `Config.toml` → reserva la memoria de la Wii → copia las secciones del DOL y de
  StaticR a esa memoria (vienen **embebidas** dentro del programa) → corre los constructores del juego → arranca
  aurora (gráficos) → prepara los hilos del juego → salta a la dirección de entrada del juego (`0x800060A4`) y
  desde ahí manda el juego. No hay un "bucle principal" del runtime: el propio juego marca los cuadros, y el
  runtime se entera cuando el juego copia la imagen terminada a la tele (`GXCopyDisp`).
- **Hilos:** solo los fibers del juego son imprescindibles. Los otros hilos (copiar el log a un archivo, mezclar
  sonido aparte, DNS) se pueden apagar: el runtime ya sabe vivir sin ellos.
- **Memoria:** el runtime funciona con bloques normales de memoria si `RequiresCheckedAccess()` es verdadero,
  como en la versión de Mac. **Y un error que habría sido grave:** las funciones `FlatWriteRam*` (el traductor
  las usa ~12 800 veces, para escribir en la pila del juego) escribían directo sin preguntar si hay memoria
  plana. En wasm habrían escrito en la dirección equivocada de la memoria lineal, corrompiendo todo en silencio.
- **Lo que solo existe en escritorio:** el menú F10 (imgui), Discord, TLS con mbedTLS, manejadores de fallas.

### 18. Lo que se cambió en el runtime · 18:30–18:45

Todo queda en `parches/runtime-web.diff` (13 archivos, siempre dentro de `#if defined(__EMSCRIPTEN__)` para que
la versión de escritorio no cambie):

| Archivo | Problema en la web | Solución |
|---|---|---|
| `memory_access.h` | `FlatWriteRam*` escribía directo (ver arriba) | Pasa por la memoria comprobada como las demás. Además `FlatLoad`/`FlatStore` **detienen el programa** si alguna vez se llaman en wasm (red de seguridad: mejor un error visible que memoria corrupta) |
| `guest_flat_memory_wasm.cpp` (nuevo) | No hay memoria virtual ni protección de páginas | Un bloque para MEM1 (24 MB), otro para MEM2 (128 MB) y sus "espejos" apuntando al mismo bloque, como en la Wii real (la misma RAM se ve en 3 rangos de direcciones). Copiado de la versión de Mac |
| `host_context.cpp` | Los hilos del juego usaban fibers de Windows / libco | Backend nuevo con los fibers de JSPI de la fase 1 (sección 12) |
| `main.cpp` | Manejador de fallas de memoria y 2 hilos para copiar el log | Se saltan en wasm: no hay fallas de hardware que atrapar y el log va directo a la consola |
| `runtime_config.h`, `main.cpp` | La lista de APIs de gráficos no conocía la web | `"auto"`/`"webgpu"` → WebGPU |
| `dvd.cpp`, `vi.cpp` | Ver secciones 21 y 22 | |

### 19. La receta de compilación propia · 18:40

El CMake de WiiCompiled exige Windows, Linux o Mac de 64 bits y baja Dawn, SDL3 nativo, Crypto++, mbedTLS… En vez
de pelear con él, `herramientas/compilar-web.py` escribe su propia receta de Ninja con **397 unidades**:

| Grupo | Qué es | Cuántas |
|---|---|---|
| runtime | `runtime/src` menos lo de escritorio (lista `EXCLUIDOS` en el script, cada uno con su motivo) | 73 |
| semántica | la matemática del procesador (sin atajos de punto flotante, igual que el juego traducido) | 3 |
| web | nuestro código: aurora sin pantalla y extras vacíos (`web/headless/`) | 3 |
| terceros | Crypto++ (firmas de la Wii), pugixml (lee el XML de Retro Rewind), xxhash | 152 |
| datos | secciones del DOL/REL y parches de RR, metidos con `#embed` (`herramientas/blobs_a_embed.py`) | 5 |
| juego | los shards traducidos del juego + Retro Rewind | 161 |

```bash
python herramientas/compilar-web.py          # compila lo que cambió y enlaza → build/web/node/mkw.js + mkw.wasm
```

Primera compilación completa: ~2 minutos con 16 hilos; después solo lo que cambia (~1,5 min, casi todo enlazar).
Resultado: **`mkw.wasm` de 121,5 MB**, sin un solo símbolo sin resolver.

**Por qué `#embed`:** WiiCompiled mete los datos del juego en el ejecutable con archivos de ensamblador
(`.incbin`) en sintaxis de Windows, que no existe para wasm. `#embed` hace lo mismo desde C++.

**SDL3:** Emscripten trae su propia versión de SDL3 adaptada al navegador (`--use-port=sdl3`, versión 3.4.2):
sonido por WebAudio y mandos por la Gamepad API, sin escribir nada.

**Trampas de esta parte:**
- Las rutas tienen un espacio ("MKW RETRO"). En Windows, Ninja ya les pone comillas a `$in`/`$out`; ponerles
  comillas a mano las duplica y se rompen. Las de las opciones `-I` sí van con comillas.
- `xxhash.c` es C, no C++: necesita su propia regla (`emcc`, sin `-std=c++20`).
- `sigsetjmp` (sección del glosario `setjmp`) necesita `-sSUPPORT_LONGJMP=wasm` al compilar y al enlazar.
- Los scripts de Python escritos desde la terminal perdían las barras invertidas (`\n` → salto de línea real):
  para cambios con `\` se usa el editor de archivos, no un comando.

### 20. aurora sin pantalla · 18:35

aurora (los gráficos) depende de Dawn, SDL3 con ventana, imgui, freetype, sqlite… y en Node no hay tarjeta de video.
Para esta fase se reemplaza por una aurora "de mentira" (`web/headless/`):

- **`aurora_vacia.cpp`** — 146 funciones que no hacen nada (`GXSetBlendMode`, `GXBegin`, `VIConfigure`…),
  **escritas por un programa**: `herramientas/generar_aurora_vacia.py` lee la lista de nombres que el enlazador
  pide (`web/headless/aurora_nombres.txt`), busca la declaración exacta de cada una en las cabeceras de aurora, y
  escribe la función con el tipo correcto. Escribirlas a mano habría sido lento y fácil de equivocar.
- **`aurora_manual.cpp`** — las 17 que tienen que responder algo con sentido:
  - `GXGetTexBufferSize`: el juego pregunta cuánta memoria reservar para una textura; tiene que dar la cifra
    exacta (fórmula copiada de aurora, licencia MIT).
  - Las colas de comandos de GX (el juego guarda y vuelve a poner su puntero).
  - Los mandos: uno conectado en el puerto 0, que Node puede "apretar" (`mkw_headless_set_pad`) para navegar
    menús sin manos en pruebas futuras.
  - `aurora_end_frame`: cuenta cuadros, cada 60 informa fps y trabajo por cuadro, y con `MKW_HEADLESS_FRAMES=N`
    termina el programa a los N cuadros guardando la memoria del juego (`MKW_HEADLESS_DUMP`).
- **`escritorio_vacio.cpp`** — el menú F10, Discord y TLS, vacíos. TLS (conexiones cifradas) solo hace falta en
  línea: mientras tanto el juego recibe "no se pudo conectar", igual que una Wii sin internet.

**Trampa:** el generador buscaba los nombres de las funciones escritas a mano con una expresión que se confundía
con el texto entre paréntesis de un comentario ("(fórmula real de aurora)") y se saltaba `GXGetTexBufferSize` →
el enlazador la encontraba dos veces. Ahora quita los comentarios antes de buscar.

### 21. Primer arranque en Node: el disco · 18:48

`web/node/correr.mjs` prepara una carpeta de datos (`build/web/datos/WiiCompiled/` hace de "AppData"), escribe un
`Config.toml` (dónde está el disco extraído y Retro Rewind; sin Discord ni red), y llama a `main()`. Node 24
todavía pide la bandera `--experimental-wasm-jspi`: el programa se relanza solo con ella.

```bash
node web/node/correr.mjs 300        # 300 cuadros = 5 s de juego; log también en build/web/datos/ultimo.log
```

1. **Primera corrida:** arrancó todo (constructores, OS de la Wii, "Memory 152 MB") y se detuvo en el disco:
   *"Configured DVD root is not an extracted DATA directory"*. El runtime interpreta las rutas del `Config.toml`
   **relativas a la carpeta del propio Config.toml**, no a donde está parado el programa. Arreglo en el runner.
2. **Segunda:** 60 cuadros… pero *"disc index: 0 disc file(s)"* y *"Load Module[1] fail (StaticR.rel)"*: el juego
   no veía ningún archivo del disco, y sin StaticR se quedaba en la pantalla de arranque. Causa: para cada archivo,
   `dvd.cpp` calcula su ruta relativa con `fs::relative`, que por dentro pide la ruta canónica (`realpath`) al
   sistema; el acceso directo al disco de Emscripten (`NODERAWFS`) no puede hacerlo con rutas de Windows y
   devolvía error, y el archivo se saltaba **sin avisar**. Arreglo: como el recorrido de la carpeta siempre
   entrega rutas que empiezan por la raíz, basta la versión "de texto" (`lexically_relative`), que no pregunta nada
   al sistema.
3. **Tercera:** el disco completo (2 037 archivos + 5 482 reemplazos de Retro Rewind), StaticR cargado desde el
   disco en 19 ms, el payload de Retro WFC ("Payload version 0.1.1"), las inicializaciones de RR, y el juego
   avanzando por sus librerías (sonido, Miis, menús, modelos 3D, en línea) hasta el aviso de Pulsar *"New race
   started"* (lo imprime al cambiar de escena). **300 cuadros en 4 segundos.**

### 22. 60 fps, sonido y esperas de verdad · 18:56–19:05

- **Sonido:** en Node no hay tarjeta de sonido, así que SDL fallaba al iniciar el audio en cada cuadro (el log se
  llenaba de avisos). Con el driver "dummy" de SDL el sonido fluye por todo el camino del juego y se descarta
  (*"output queue full… dropping blocks"* = el sonido está llegando).
- **Ritmo:** desde el cuadro ~240 el juego se frena solo a **60,0 fps exactos**, como en la Wii.
- **Trampa (me equivoqué al diagnosticar):** con el driver dummy la corrida "no terminaba". Parecía congelada (casi
  sin uso de procesador), pero el log mostraba que **sí había terminado** (1 200 cuadros, volcado escrito): era
  Node el que no se cerraba, porque el driver deja un temporizador vivo. Arreglo: el runner sale a mano al final.
- **Esperas que ceden:** en wasm, `sleep_until` es una espera activa (el único hilo gira mirando el reloj). En el
  navegador eso congelaría la página y además no deja saber cuánto trabaja el juego de verdad. Ahora la función
  de espera del runtime (`SleepPreciselyUntil`, en `vi.cpp`) usa `emscripten_sleep`: con JSPI suspende el juego y
  le devuelve el control a Node/al navegador; como los temporizadores tienen ~1 ms de resolución, el último
  milisegundo se completa girando. Además suma el tiempo esperado para calcular el **trabajo por cuadro**.

**Resultado (1 200 cuadros):** 60,0 fps estables; **trabajo ~1 ms por cada cuadro de 16,67 ms** (el juego en sus
pantallas de inicio, sin dibujar). Es decir, la lógica del juego usa ~6 % del tiempo disponible.

**Ojo con lo que esa cifra NO incluye:** dibujar (aurora y WebGPU están vacíos en esta fase) y las carreras, que
pesan más que los menús. Es un buen punto de partida, no la cifra final.

### 23. Prueba del banco: arranque · 19:09

`web/node/prueba-arranque.mjs` corre el juego N cuadros y revisa el log punto por punto. Es una prueba de Node (no
una página) porque el `.wasm` del juego nunca se sirve desde el banco: es código de Nintendo.

```bash
node web/node/prueba-arranque.mjs 600
```

| ✓ | Qué comprueba |
|---|---|
| ✓ | lee su `Config.toml` |
| ✓ | carga las secciones del DOL y StaticR embebidos |
| ✓ | corre los constructores del juego (DOL y StaticR) |
| ✓ | arranca el sistema operativo de la Wii |
| ✓ | lee el disco extraído (2 037 archivos, 5 482 reemplazos de RR) |
| ✓ | carga StaticR.rel desde el disco |
| ✓ | se ejecuta el código de Retro Rewind (payload de Retro WFC) |
| ✓ | el juego cambia de escena |
| ✓ | llega a los 600 cuadros |
| ✓ | mantiene 60 fps desde el cuadro 300 (mínimo 60,0) |
| ✓ | el trabajo por cuadro cabe en 16,67 ms (máximo 1,24 ms) |
| ✓ | deja el volcado de memoria (152 MB) |
| ✓ | termina sin errores |

**13 bien, 0 mal en 9,5 s. Fase 2 terminada.**

**Lo que sigue (fase 3):** compilar la aurora de verdad con WebGPU del navegador y mostrar la imagen en un
`<canvas>`; el ritmo de 60 fps con `requestAnimationFrame` (no con temporizadores, que Chrome redondea a 4 ms);
sonido por WebAudio; controles.

---

## Fase 3 — el juego en el navegador, con imagen

**Meta de esta etapa:** cambiar la aurora "de mentira" de la fase 2 por la de verdad, que dibuje con WebGPU en un
`<canvas>` de una página, a 60 fps. (Controles, sonido y partidas guardadas en el navegador vienen después.)

### 24. El mapa de aurora · 19:00

Antes de tocar nada, leí cómo está armada aurora (sus archivos `cmake/aurora_*.cmake` y su código) para saber qué
partes dependen del PC:

- **6 piezas, ~60 archivos:** `core` (arranque, ventana, imgui, conexión con la GPU), `gx` (traduce los gráficos de
  la Wii a WebGPU: 39 archivos), `pad`/`si` (mandos), `vi` (video), `mtx` (matemática de matrices, en C).
- **Dawn nativo** (la versión de WebGPU para programas de PC) aparece solo en **2 archivos** (`webgpu/gpu.cpp` y
  `dawn/BackendBinding.cpp`), y casi todo detrás de una marca (`WEBGPU_DAWN`). En la web no se usa esa marca: el
  WebGPU lo pone el navegador a través de *emdawnwebgpu*.
- **Hilos** en 4 lugares: el trabajador de cuadros y el presentador (`aurora.cpp`), los compiladores de shaders
  (`pipeline_cache.cpp`) y la interpolación de cuadros. El juego web tiene un solo hilo, así que todo eso tiene
  que correr "en línea". Buena noticia: aurora **ya traía** un camino sin hilos para Mac y para
  "WebGPU del navegador" (`BackendType::WebGPU` en `pipeline_cache.cpp`, y la marca `ENABLE_BACKEND_WEBGPU`).

### 25. Las librerías de aurora · 19:05

En el PC, aurora baja sus librerías sola con CMake. Para la web las bajo con un script, con **las mismas versiones
y las mismas huellas SHA-256** que fija aurora (así es exactamente el código que ellos probaron):

```bash
bash herramientas/bajar-deps-aurora.sh
```

Queda en `terceros/deps-aurora/` (ignorado por git): abseil, fmt, imgui, sqlite y tracy. zlib y libpng no se bajan:
Emscripten las trae como *ports* (`-sUSE_ZLIB=1 -sUSE_LIBPNG=1`). Versiones en `herramientas/versiones.md`.

**imgui necesitó un parche de una línea** (`parches/imgui-web.diff`): su versión 1.91.9 prohíbe la opción "Dawn"
cuando compila para la web, porque en esa época la web usaba otra API. Con emdawnwebgpu la API web **es** la de
Dawn, así que se quita esa prohibición (imgui 1.92 hizo lo mismo).

### 26. Los cambios a aurora · 19:10–19:20

Todos van dentro de `#ifdef __EMSCRIPTEN__` (solo se activan al compilar para la web; la versión de PC queda igual)
y están en `parches/aurora-web.diff`:

| Archivo | Cambio | Por qué |
|---|---|---|
| `dawn/BackendBinding.cpp`, `webgpu/gpu.cpp` | La superficie es el `<canvas id="canvas">` de la página | En el PC es una ventana de Windows (HWND); en la web, un canvas |
| `webgpu/gpu.cpp` | Sin las funciones exclusivas de Dawn nativo (memoria compartida con Metal, sincronización entre hilos, registro de mensajes de Dawn) | No existen en el WebGPU del navegador; el compilador avisó cada una |
| `aurora.cpp` | Sin trabajador de cuadros ni presentador en otro hilo | Un solo hilo |
| `aurora.cpp` | Sin `Present()` | En el navegador no existe (aborta); la página muestra la imagen sola al recuperar el control |
| `aurora.cpp` | `wait_until_precise` cede con `emscripten_sleep` | La espera original giraba en vacío y congelaría la página |
| `gfx/pipeline_cache.cpp` | Caché de shaders en disco apagada | Necesita un hilo escritor y un disco de verdad; Chrome ya guarda sus shaders compilados |
| `gx/frame_interpolation.cpp` | Interpolación sin hilos ayudantes | Un solo hilo |
| `gfx/staging_map.hpp` | Ceder mientras espera un búfer de la GPU | Ver §29: era el congelamiento |
| `gfx/dds_io.cpp` | Un `static_cast<size_t>` | En wasm los tamaños son de 32 bits y el compilador no acepta achicar sin avisar |

### 27. La receta para el navegador · 19:20–19:27

`herramientas/compilar-web.py` ahora tiene dos modos:

```bash
python herramientas/compilar-web.py --modo node        # sin pantalla (fase 2)
python herramientas/compilar-web.py --modo navegador   # aurora de verdad (fase 3)
```

- **Comparten los objetos** (`.o`) del runtime y del juego: los 161 pedazos traducidos no se recompilan al cambiar
  de modo (están en `build/web/node/obj`; la carpeta se llama "node" porque ese modo llegó primero). La primera vez
  el modo navegador compiló solo **186 de 579 piezas**: aurora (58), sus librerías (125) y lo que cambió.
- Grupos nuevos: `aurora` (con `-O3 -ffast-math` como el CMake original; `frame_interpolation.cpp` aparte con
  `-fno-finite-math-only`, igual que en el original), `librerias` (abseil, fmt, imgui, sqlite) y `puente`
  (`web/navegador/puente.cpp`: dos funciones que la página llama para saber cuántos cuadros lleva el juego y cuánto
  esperó).
- Enlace: `--use-port=emdawnwebgpu`, `-sENVIRONMENT=web` (para el navegador), `-sFORCE_FILESYSTEM=1` (MEMFS) y
  `--profiling-funcs` (deja los nombres de las funciones para poder perfilar).

**Trampas:** fmt 11.1.4 usa `malloc`/`free` sin incluir `<cstdlib>` (se agrega `-include cstdlib`, lo mismo que hace
el CMake de aurora para MinGW); la lista `PreferredBackendOrder` quedaba vacía sin `-DENABLE_BACKEND_WEBGPU`.

**Resultado:** compiló todo y **enlazó a la primera**: `build/web/navegador/mkw.wasm` de 126,9 MB.

### 28. Los archivos del disco en el navegador · 19:30

El juego necesita 2,6 GB de disco + 2,1 GB de Retro Rewind. No se pueden bajar enteros al abrir la página, y el
navegador no puede leer el disco del PC. La solución tiene tres partes:

1. **Servidor local** (`web/navegador/servidor.mjs`, solo `127.0.0.1`, puerto 8140): al arrancar recorre las carpetas
   y arma el **manifiesto** (6 065 archivos con su tamaño, más las carpetas vacías). Sirve los archivos con
   **HTTP Range**. El juego y el disco son privados: este servidor nunca sale de la PC.
2. **La página** (`web/navegador/mkw.mjs`) baja enteros solo los **archivos chicos** que el runtime abre "a la
   antigua" (29 archivos, 9,9 MB: `sys/` del disco, el XML de Retro Rewind, la partida de RR, los archivos base del
   runtime) y crea los otros 6 036 como **archivos perezosos** en MEMFS: existen y dicen su tamaño (así el runtime
   arma su índice igual que en el PC), pero no tienen contenido.
3. **El runtime** lee los archivos del disco siempre por una misma función (`DvdReadContract::ReadExact`). El parche
   le agrega: "si la página ofrece un lector (`Module.mkwLeeRango`), pídeselo a ella". La página baja solo ese pedazo
   con HTTP Range y, gracias a JSPI, el juego queda en pausa mientras llega (para el C++ parece una lectura normal).
   En Node no hay lector y sigue leyendo del disco como antes.

Si algo intentara leer un archivo perezoso "a la antigua", la página lo anota claro en el log (y la prueba lo revisa).

**Trampa:** al principio Riivolution saltaba un reemplazo más que en Node: el manifiesto solo listaba archivos, y
dos carpetas vacías de RR (`MyStuff`, `Patches`) no existían. Ahora el manifiesto incluye las carpetas vacías.

### 29. Primer arranque en Chrome: dos tropiezos · 19:35–19:42

1. **La NAND no se podía guardar** (*"Cannot persist NAND setting.txt"*). El runtime guarda los archivos de la NAND
   escribiendo un temporal y creando un **enlace duro** al nombre final (así nunca pisa uno existente). MEMFS no
   tiene enlaces duros. En la web: "si el destino no existe, renombrar" (con un solo hilo nadie puede meterse en el
   medio, así que es igual de seguro). Cambio en `nand_settings.h` y `nand_api.cpp`.
2. **La página se congelaba** justo después de iniciar el video. La herramienta normal no servía (la página no
   respondía), así que hice una prueba con Playwright que puede **pausar** la página. El culpable: al empezar cada
   cuadro aurora espera que la GPU le devuelva un búfer (**MapAsync**) en un ciclo `ProcessEvents()` + variable de
   condición. En el PC la respuesta llega desde otro hilo; en el navegador llega solo cuando la página "respira", y
   el ciclo nunca la dejaba respirar. Arreglo en `staging_map.hpp`: mientras espera, **ceder** con
   `emscripten_sleep(0)`.

**Resultado:** ¡la **pantalla de título de Mario Kart Retro Rewind** dibujada con WebGPU en el canvas! (captura:
`build/web/datos/navegador.png`, no se sube a git).

### 30. De 46 a 60 fps · 19:45–19:50

La primera medida dio ~46 fps (sin ventana) y ~57 fps (con ventana), con ~21 ms por cuadro. En vez de adivinar,
**perfilé** (prueba con `--perfil 14`, que mide 4 s y lista qué funciones gastan más):

```text
66.8 %  escribe        ← ¡la función de log de MI página, no el juego!
12.6 %  (idle)
```

Dos causas, ninguna del juego:

- La página **redibujaba el cuadro de log en cada línea** (unir 400 líneas y repintar, miles de veces por segundo).
  Ahora redibuja como mucho una vez por refresco de pantalla.
- El runtime escribía ~230 líneas por segundo: *"starting the AX/DSP mix worker thread… failed"*. Faltaba
  `mix_worker = false` en el `Config.toml` del navegador (en Node sí estaba): el sonido intentaba crear un hilo
  en cada bloque de audio.

**Resultado: 60,0 fps estables, ~7,3 ms de trabajo por cuadro** (de los 16,7 disponibles) en la pantalla de título.

### 31. ¿Los cuadros caen parejos con el monitor? · 19:52

Un promedio de 60 fps puede esconder tirones. La página ahora cuenta, en cada refresco del monitor
(`requestAnimationFrame`), cuántos refrescos pasaron desde el cuadro anterior. Creí que este PC tenía un monitor
de **~180 Hz** y que lo parejo era "cada 3 refrescos" (**corrección en §33: es de 240 Hz**; la tabla de abajo
contaba llamadas de rAF, no refrescos reales):

| Refrescos entre cuadros | Veces |
|---|---|
| 3 (parejo) | 1 119 (91 %) |
| 4 | 89 |
| 2 | 14 |
| 6 | 4 |
| 1 | 1 |

El ~8 % desparejo viene del temporizador del navegador (`setTimeout` llega 1–4 ms tarde, y en 180 Hz un refresco
dura 5,5 ms). **En un monitor de 60 Hz el margen alcanza** (7 ms de trabajo + hasta 4 ms de atraso < 16,7 ms).

**Por qué no lo arreglé ya:** la idea obvia —despertar el juego con `requestAnimationFrame` un poco antes— no sirve,
porque el runtime entrega cada "barrido de la tele" (retrazado VI) según el reloj de pared: si despierta antes, el
barrido todavía no "venció" y el juego vuelve a esperar. El arreglo correcto es **correr la fase del reloj VI** del
juego para que sus barridos caigan justo después de un refresco (como enganchar un PLL). Es un cambio de diseño en
`vi.cpp`; queda anotado en el PLAN para hacerlo con calma y medido.

### 32. Prueba del banco: el juego en el navegador · 19:55

`web/navegador/prueba-navegador.mjs` levanta el servidor local (puerto 8141), abre el Chrome instalado con
Playwright (**sin sonido**, `--mute-audio`, pedido del dueño), abre la página con `?auto=1&cuadros=N`, copia la
consola a `build/web/datos/navegador.log` y saca una captura del canvas.

Instalar Playwright una vez (solo la parte que maneja Chrome, sin bajar otro navegador):

```bash
cd banco && npm install
```

Correr la prueba:

```bash
node web/navegador/prueba-navegador.mjs 900
```

Opciones: `--ventana` (Chrome visible), `--perfil 14` (perfil a los 14 s), `--pausa 20` (pausar y mostrar dónde
estaba el programa).

| ✓ | Qué comprueba |
|---|---|
| ✓ | el navegador tiene WebGPU y JSPI |
| ✓ | manifiesto del disco (6 065 archivos) |
| ✓ | archivos chicos bajados (29, 9,9 MB) |
| ✓ | el juego (wasm) cargó (~400 ms) |
| ✓ | primer cuadro dibujado (~1,4 s después) |
| ✓ | aurora creó WebGPU sobre el canvas (BGRA8, Fifo) |
| ✓ | el juego lee el disco por pedazos (85 lecturas, 19,9 MB) |
| ✓ | el código de Retro Rewind corre |
| ✓ | 60 fps desde el cuadro 300 (medio 60,0, mínimo 60,0) |
| ✓ | el trabajo por cuadro cabe en 16,67 ms (máximo ~7,6 ms) |
| ✓ | hay imagen en el canvas (99 % de píxeles con color) |
| ✓ | sin lecturas perezosas "a la antigua" |
| ✓ | cuadros parejos con el monitor (≥ 98 %) — agregada en §33 |

**12 bien, 0 mal**, con ventana y sin ventana. La prueba de Node de la fase 2 sigue en **13 bien, 0 mal**.

Para jugar a mano: `node web/navegador/servidor.mjs` y abrir `http://127.0.0.1:8140/` (botón "Arrancar el juego").

**Lo que sigue:** enganchar el reloj VI al refresco del monitor; controles (teclado, mandos, celular); sonido
WebAudio (probar el desbloqueo con el primer clic); partidas guardadas en IndexedDB/OPFS; medir una carrera.

### 33. El reloj del juego enganchado al monitor (un PLL) · 19:58–20:20

**El problema** (ver §31): el juego decide cuándo empieza cada cuadro con su propio reloj de la "tele" (el reloj
VI: una grilla de barridos cada 16,666 ms, por reloj de pared), y el monitor refresca con el suyo. Si los dos no
están en fase, y encima el temporizador del navegador despierta 1–4 ms tarde, algunos cuadros quedan en pantalla
un refresco de más o de menos: tirones.

**La idea, como un PLL** (lazo de enganche de fase, el mismo de los circuitos):

| Pieza del PLL | Aquí |
|---|---|
| Referencia | El refresco del monitor. La página lo mide con `requestAnimationFrame`: hora del último refresco `t` y período `p` (en `web/navegador/mkw.mjs`, `relojMonitor`) |
| Oscilador controlado | La grilla del reloj VI del runtime (`g_vi.lastRetrace` en `vi.cpp`) |
| Detector de fase | En cada cuadro: ¿a cuántos ms de un refresco cae el próximo barrido? (error entre −p/2 y +p/2) |
| Filtro / ganancia | Corrige 1/4 del error por cuadro, como mucho 0,25 ms (el juego nunca cambia de velocidad más de 1,5 % por un instante; ya enganchado, las correcciones son de microsegundos) |
| Condición de enganche | Solo si 16,67 ms es un número entero de refrescos (60, 120, 180, 240 Hz). En 144 Hz no hay fase que sirva y se deja suelto |

Y la **espera final** ya no usa `setTimeout`: el runtime le pide a la página "despiértame con el último refresco
antes del vencimiento" (`Module.mkwEsperaHasta`) y gira el resto (menos de un refresco). Mientras espera, la página
lo despierta cada ~1 ms para que atienda el sonido y las alarmas del juego, igual que antes.

**Tropiezos, en orden:**

1. **El monitor es de 240 Hz, no de 180.** Mientras el juego calcula (~7 ms), Chrome no puede llamar a
   `requestAnimationFrame`, así que se saltan refrescos y medir "llamadas de rAF" engaña. Ahora el período se mide
   por **hora**: cada salto cuenta como round(salto / p0) refrescos y p = suma de saltos / suma de refrescos
   (promedio de ~2 s, preciso). Lo mismo para la tabla de huecos de la prueba.
2. **Enganchado pero 70 % parejo.** Con el barrido justo después del refresco, el cuadro tardaba ~8,2 ms y terminaba
   a 8,45 ms… pegado al borde de 2 refrescos (8,33 ms): a veces lo mostraba un refresco, a veces el siguiente
   (3-5-3-5). Arreglo: el runtime mide cuánto tarda el cuadro (promedio) y, **si el cuadro dura más de un
   refresco**, elige la fase para que **termine a mitad de un refresco** (lejos de los dos bordes). En 60 Hz (el
   cuadro cabe con margen en un refresco) sigue empezando justo después del refresco.

**Resultado** (monitor de 240 Hz, pantalla de título, 1 500 cuadros; prueba con ventana, sin tocarla):

| | Cuadros que duran exactamente 4 refrescos | Enganchados (error < 0,5 ms) |
|---|---|---|
| Sin enganche (`--sin-enganche`) | 90,7 % (con huecos de 3, 5, 6 y 9) | — |
| **Con enganche** | **99,0 %** (solo 6 de 3 y 6 de 5) | 1 387 de 1 387 |

La prueba del navegador suma el punto **"cuadros parejos con el monitor (≥ 98 %)"** → **13 bien, 0 mal** (con y sin
ventana). Node sigue **13 bien, 0 mal** (allí no hay monitor: el reloj queda como antes).

```bash
node web/navegador/prueba-navegador.mjs 1500 --ventana                 # con enganche
node web/navegador/prueba-navegador.mjs 1500 --ventana --sin-enganche  # para comparar
```

### 34. ¿Qué tarjeta de video usa? La opción en la página · 20:05–20:15

El dueño preguntó cómo sabe el juego qué GPU usar y pidió poder elegirla. Lo que hay que saber:

- **Una página web no puede elegir la tarjeta por su nombre** (por privacidad y seguridad). Solo puede pedirle al
  navegador `powerPreference: "high-performance"` (alto rendimiento) o `"low-power"` (bajo consumo).
- **Chrome en Windows hoy ignora ese pedido** (él mismo lo avisa en la consola, crbug.com/369219127): usa la
  tarjeta que **Windows** le asignó a Chrome. Probé también lanzar Chrome con `--force_high_performance_gpu`: tampoco
  cambia.
- **Hallazgo:** en este PC, **Chrome usa la gráfica integrada AMD del Ryzen** (RDNA2), no la RTX 3080 Ti. El
  navegador integrado de la app de Claude, en cambio, usa la **NVIDIA (Ampere)**. Las medidas de §30–33 son con la
  integrada: con la RTX debería sobrar todavía más.

**Lo que se hizo:**

- Opción **"Tarjeta de video"** arriba en la página (alto rendimiento / bajo consumo / sin preferencia). Se guarda en
  el navegador (`localStorage`), al cambiarla se recarga la página, y llega a aurora (`Module.mkwGpuPreferencia` →
  parche en `gpu.cpp`, que antes tenía "alto rendimiento" fijo).
- Al abrir la página muestra **qué tarjeta está en uso** y le pide al navegador una de cada tipo: si da **la misma**
  para los dos pedidos, avisa en rojo que la opción no tiene efecto en ese navegador y explica cómo cambiarla en
  Windows: Configuración → Sistema → Pantalla → Gráficos → el navegador → *Alto rendimiento* (dedicada) o
  *Ahorro de energía* (integrada), y reiniciar el navegador.
- La prueba acepta `--gpu alto|bajo|auto`.

**Lo que sigue:** controles (teclado, mandos, celular) — hecho en §35; sonido WebAudio; partidas guardadas en IndexedDB/OPFS;
medir una carrera (y con la RTX, si el dueño cambia la preferencia de Windows para Chrome).

### 35. Controles: teclado, mandos y celular · 20:20–20:40

**Qué se quería:** que el juego se pueda jugar con teclado, con mandos (varios a la vez) y en el celular (botones
en la pantalla + dirigir inclinando el teléfono). Decisión del dueño: **todo llega al juego como un mando de
GameCube**, por un gancho de la página.

**Cómo lee el juego sus mandos.** Mario Kart llama a la función de Nintendo `PADRead`, que devuelve el estado de los
4 puertos: botones (un bit cada uno), stick principal, stick C y los dos gatillos. En la versión de PC de
WiiCompiled esa función la pone aurora (`lib/dolphin/pad/pad.cpp`), que lee los mandos con SDL. Revisé qué funciones
de mando usa de verdad el runtime: son **11** (las demás son del menú F10 y del asistente para configurar mandos,
que en la web no existen).

**La pieza nueva del lado del juego:** `web/navegador/pad_web.cpp` reemplaza ese `pad.cpp` (en
`herramientas/compilar-web.py` se saca `pad/pad.cpp` de la lista de aurora). Guarda el último estado de cada puerto
y le ofrece a la página una función, `mkw_web_pad(puerto, conectado, botones, sx, sy, cx, cy, gl, gr)`. `PADRead` solo
copia eso. Cuando el juego pide vibrar (`PADControlMotor`), avisa a la página (`Module.mkwVibrar`). No se tocó
código de terceros: los parches no cambian.

**La pieza nueva del lado de la página:** `web/navegador/controles.mjs`. En cada refresco de pantalla junta las
fuentes, arma el mando de GameCube de cada puerto y lo manda al juego **solo si cambió**:

| Fuente | Qué hace | Puerto |
|---|---|---|
| Teclado | Stick WASD/flechas (a fondo), A = K/Enter (acelerar), B = J/Retroceso, R = L/Shift (derrapar), L = Espacio/I (objeto), cruz T/G/F/H (truco = T), X = U, Y = O, Z = N, Start = P/Esc. Se cambia en la página y se guarda en `localStorage` | 1 |
| Mandos (Gamepad API, mapeo "standard") | Botón de abajo = A, derecho = B, izquierdo = X, arriba = Y; LB = L (objeto), RB = Z; gatillos LT/RT analógicos = L/R; stick izquierdo con zona muerta de 15 %; stick derecho = stick C; cruz = cruz; Start/Select = Start | el 1.º comparte el 1 con el teclado; los otros, 2 a 4 |
| Mando táctil | Stick + A, B, R, L, ↑ (truco) y Start encima del juego; varios dedos, se re-mide en cada dedo (por si la pantalla gira), deslizar de un botón a otro cambia de botón | 1 |
| Inclinar el teléfono | Al activarlo, esa posición es el centro; 35° de giro = stick a fondo; 3° de zona muerta | 1 (suma al stick) |

Un detalle que encontró la prueba: el teclado y el táctil no tienen gatillos analógicos, así que cuando aprietan
L o R se manda también el gatillo a fondo (255); pero un mando con el gatillo a medias no debe verse forzado a 255.
Al principio había una regla general que lo forzaba siempre; ahora cada fuente decide lo suyo.

**El panel "Controles" de la página** (debajo del juego): casillas para el mando táctil (se prende solo si el
puntero principal es un dedo) y para dirigir inclinando, botón de pantalla completa (en el celular además intenta
ponerla horizontal), la lista de mandos conectados, lo que recibe el puerto 1 en vivo y la tabla de teclas (clic en
una y apretar la nueva; Esc cancela; "restaurar" vuelve a las de fábrica).

**Pruebas sin el juego: `banco/pruebas/controles/`.** Un "juego falso" anota lo que recibe cada puerto, y se
simulan teclas, mandos falsos (se reemplaza `navigator.getGamepads` por una lista que maneja la prueba), dedos
(pointer events), inclinación (`deviceorientation`) y vibración → **28 bien, 0 mal**.

**Prueba con el juego de verdad** (nueva en la prueba del navegador): en la pantalla de título se aprieta la tecla K
como lo haría una persona (un `keydown` en la ventana, que pasa por `controles.mjs` → `mkw_web_pad` → `PADRead`). Para
no confundir la reacción con la animación propia del título, primero se mide una **línea base** de 2 s sin tocar
nada y después 3 s tras apretar:

| | Imagen que cambió | Lecturas nuevas del disco |
|---|---|---|
| 2 s sin tocar nada | 0 % | 0 |
| 3 s después de apretar A | **24 %** | 0 |

El juego pasó del título a la **pantalla de licencias** (los 4 cuadros "NEW" con el botón "Back"); la captura queda
en `build/web/datos/navegador.png`. No leyó nada nuevo del disco porque esos menús ya estaban cargados.

**Una corrección en la medición de 60 fps.** En una corrida, el punto "60 fps desde el cuadro 300" falló con un
mínimo de 53,4 fps. Mirando el medidor segundo a segundo: ese segundo **empezó** en el cuadro 268, todavía en la
carga del arranque, y como **terminó** pasado el 300 entraba en la cuenta. Ahora solo cuentan los segundos que
empiezan pasado el cuadro 300.

**Algo real que apareció:** justo después de apretar A, dos segundos bajan a 51–58 fps (hasta 11 ms de trabajo en
un cuadro), solo la primera vez. Lo más probable es que sea WebGPU armando por primera vez las "recetas" de dibujo
(pipelines) de los gráficos nuevos del menú. Queda anotado en el PLAN para medirlo y "precalentar".

**Resultado:** prueba del navegador **15 bien, 0 mal**; banco de controles **28/0**.

```bash
node web/navegador/prueba-navegador.mjs 900
```

(La página del banco es `banco/pruebas/controles/index.html`; también está en la lista de `banco/index.html`.)

**Falta en controles:** tamaño y opacidad ajustables del mando táctil, probarlo en un teléfono de verdad (o
emulado por CDP como un Pixel 7) y comprobar que ningún botón táctil se pise con otro a ningún tamaño.

**Lo que sigue:** sonido (WebAudio, que se desbloquea con el primer toque o tecla) — hecho en §36; partidas guardadas en
IndexedDB/OPFS, medir una carrera, y guardar lo bajado del disco para no volver a pedirlo.

### 36. Sonido: desbloqueo, volumen, medidor y ajuste fino del ritmo · 20:40–21:05

**Qué se quería:** que el juego suene en el navegador, que el sonido se active con el primer toque o tecla (Chrome
no deja sonar una página antes) y probarlo en el banco.

**Cómo sale hoy el sonido.** El juego mezcla su audio (música, efectos) y el runtime lo entrega a SDL3
(`audio_backend.cpp` → `SDL_PutAudioStreamData`, a 32 000 muestras por segundo). SDL3, en el navegador
(`SDL_emscriptenaudio.c`), crea un **AudioContext** (la tarjeta de sonido de la página, a 48 000 Hz) y un
**ScriptProcessorNode**: cada 2048 muestras (42,7 ms) el navegador le pide un bloque nuevo y SDL3 lo llena con lo
que mezcló el juego, convertido de 32 000 a 48 000 Hz (remuestreo). O sea: **ya sonaba**; faltaba controlarlo.

**Lo nuevo de la página: `web/navegador/sonido.mjs`.** Se mete entre SDL3 y los parlantes **sin tocar SDL3**:

```
juego (SDL3) → [medidor de entrada] → [volumen] → [medidor de salida] → parlantes
```

El truco: antes de cargar el juego, la página reemplaza `AudioContext` por una versión propia que es igual en
todo, salvo que su "salida" (`destination`) es nuestra cadena. SDL3 hace `new AudioContext()` y se conecta "a la
salida" como siempre… y queda pasando por el volumen y los medidores. Es como intercalar un atenuador y un
voltímetro en la línea de audio sin abrir el amplificador.

- **Desbloqueo:** al primer toque, clic o tecla se llama a `resume()`. Mientras tanto, la página muestra un aviso
  discreto ("el navegador tiene el sonido bloqueado hasta que toques la página…"). SDL3 trae además su propio
  intento (cada 43 ms mira si la persona ya tocó la página).
- **Volumen y silencio** en "Opciones", guardados en el navegador. La barra va **al cuadrado** (50 % → ganancia
  0,25): el oído percibe el volumen de forma logarítmica, y con una barra lineal casi todo el cambio pasaría arriba.
- **Medidor:** nivel en dB (antes del volumen, así mide aunque esté en silencio), bloques pedidos, bloques mudos,
  **huecos** (un bloque mudo entre bloques con sonido = un corte audible) y cuánto tarda SDL3 en llenar cada bloque.

**Primera medición en el juego** (prueba del navegador): la música del título sale a **−14 dB** (normal), y llenar un
bloque cuesta **0,05 ms** (nada: el sonido no le quita tiempo al dibujo). Pero aparecieron cortes:

1. **En el arranque** (segundo 4): 2 huecos y bloques tirados. Es cuando el juego se traba leyendo el disco
   (22 fps): no entrega sonido a tiempo y después se pone al día de golpe. Se irá con la caché de lo bajado del disco.
2. **Durante el juego**, cada tanto, la cola del runtime se llenaba y **tiraba un bloque** (el runtime avisa
   "output queue full"). Esto es más de fondo, y es lo interesante de hoy.

**El problema de los dos relojes (deriva).** El juego fabrica sonido al ritmo de **su** reloj: `Audio_HLE_Tick`
cuenta tiempo del juego, y ese tiempo lo marca el reloj VI, que desde §33 va **enganchado al monitor** (240,1 Hz →
60,025 cuadros por segundo, no 60). La tarjeta de sonido, en cambio, consume exactamente 48 000 muestras por
segundo según **su propio cristal**. Dos osciladores libres nunca dan exactamente lo mismo: si el que llena va un
0,1 % más rápido que el que vacía, la cola (un **FIFO** de 120 ms como máximo) sube 1 ms por segundo y, al llegar
al tope, el runtime tira un bloque entero → un "clic". Es el mismo problema que tiene cualquier enlace de audio
digital entre dos equipos con relojes distintos.

**El arreglo: ajuste fino del ritmo de reproducción** (parche en `runtime/src/audio_backend.cpp` y `.h`, solo para la
web). Después de cada entrega, el runtime mira cuántos ms hay en la cola (promediados, porque la cola sube y baja
un bloque de 43 ms cada vez que el navegador se lleva uno) y corrige la velocidad de reproducción con
`SDL_SetAudioStreamFrequencyRatio`: si la cola está por encima de 60 ms, reproduce un poquito más rápido; si está por
debajo, un poquito más lento. Es un **controlador PI**, igual que el filtro de lazo de un PLL:

- **P (proporcional):** 10 ms de error → 0,1 % de corrección inmediata.
- **I (integral):** va "aprendiendo" la diferencia fija entre los relojes, para que la cola quede justo en 60 ms y
  no un poco corrida (con solo P quedaba en 80–90 ms).
- Tope: ±0,6 % (unos 10 cents de afinación, inaudible) y cambios en pasos de 0,01 % para no reajustar SDL a cada rato.

**Lo que midió el ajuste:** la corrección que se necesita es **~0,13 %**, más que el 0,04 % que explica el
monitor. El resto (~0,09 %) cuadra con que la Wii real no reproduce a 32 000 Hz exactos sino a ~32 029 Hz (sale de
dividir su reloj de 54 MHz), y el runtime le dice a SDL "32 000". El ajuste absorbe las dos cosas sin tener que
saber cuál es cuál.

| Prueba de 30 s (1800 cuadros) | Cola | Bloques tirados desde el cuadro 300 |
|---|---|---|
| Sin ajuste (`--sin-ajuste-sonido`) | 81–92 ms y subiendo | **2** (2 cortes audibles) |
| **Con ajuste (PI)** | 50–90 ms, centrada en ~60 | **0** |

**Probar el desbloqueo tuvo su trampa.** Chrome manejado por Playwright **nunca** bloquea el sonido, aunque se le
pida con `--autoplay-policy=user-gesture-required`: lo lanza con `--enable-automation`, y además cada vez que la
prueba le pregunta algo a la página (`evaluate`, `waitForFunction`) Chrome lo cuenta como si la persona la hubiera
tocado. Por eso:

- la página acepta `?bloquearSonido=1`, que suspende el AudioContext apenas se crea (como haría Chrome con una
  persona), y la prueba del navegador lo usa;
- antes del clic, la prueba **no le pregunta nada a la página**: lee la consola hasta que el medidor dice "sonido
  bloqueado" y recién ahí hace un clic de verdad en el título de la página.

**Pruebas:**

- `banco/pruebas/sonido/` (sin el juego, con un "SDL3 falso" que toca un tono de 440 Hz a −30 dB y un bloque mudo a
  propósito): arranca bloqueado y sin pedir bloques; el botón lo desbloquea (`pointerdown`); el medidor lee el
  nivel exacto del tono (0,0213 contra 0,0212 esperado); volumen 50 % → salida = 1/4; silencio → nada sale pero se
  sigue midiendo; quedan guardados; el bloque mudo cuenta como 1 hueco → **13 bien, 0 mal**. Necesita un clic (es
  justamente lo que prueba).
- Prueba del navegador: 5 puntos nuevos de sonido (lo abrió por nuestra cadena, arrancó bloqueado y lo desbloqueó
  el clic, suena, sin cortes desde el cuadro 300, cola centrada) → **19 bien, 1 mal**.

**El que falla: "cuadros parejos con el monitor".** En estas corridas dio entre 82 y 100 % (antes, 99 % fijo). Para
ver si era culpa del sonido hice una comparación **A/B** con la misma compilación: con el módulo de sonido dio 99,8 y
97,4 %; sin él (`?sonidoPagina=0`), 98,9 y 98,7 %. O sea, varía igual con o sin sonido: es otra cosa (la máquina,
la tarjeta, cómo presenta los cuadros). Queda en el PLAN para investigarlo aparte.

**Además, pedido del dueño:** se quitó la opción "Tarjeta de video" (en Windows no sirve: decide Windows). La
página dice qué tarjeta usa y, solo si el navegador ignora el pedido, ofrece una ayuda **plegada y discreta** para
cambiarla desde Windows. Los avisos (el de la tarjeta y el del sonido bloqueado) ahora son una franja suave con
borde de color, no un cartel rojo.

```bash
node web/navegador/prueba-navegador.mjs 1800                      # con ajuste
node web/navegador/prueba-navegador.mjs 1800 --sin-ajuste-sonido  # para comparar
```

**Falta en sonido:** los cortes del arranque (caché del disco) y bajar la latencia (~100–150 ms entre que el juego
mezcla y se oye: bloque de 43 ms + cola de 60 ms) pasando de ScriptProcessorNode a AudioWorklet.

**Lo que sigue:** partidas guardadas en IndexedDB/OPFS, guardar lo bajado del disco, medir una carrera.

### 37. ¿Viene todo desbloqueado? Sí: lo hace Retro Rewind · 21:05–21:20

**Qué se pidió:** revisar si en una partida nueva viene todo desbloqueado (personajes, vehículos, copas) y, si no,
desbloquearlo.

**Cómo se revisó.** La partida que trae Retro Rewind (`riivolution/save/RetroWFC/RMCP/rksys.dat`) está vacía: ninguna
licencia. Lo que define qué está bloqueado es lo que pase al crear una. Para eso se hizo
`web/navegador/guion.mjs`: abre el juego en Chrome, aprieta teclas como una persona (K = A, J = B, T/G/F/H = cruz…)
con pausas y saca una foto del juego en cada paso (`build/web/datos/guion/`). Con él: título → licencia nueva → Mii
invitado → menú → Un jugador → Grand Prix → 100cc → personajes → vehículos → copas.

**Resultado (licencia recién creada):**

| Qué | En el juego original (licencia nueva) | Con Retro Rewind |
|---|---|---|
| Personajes | 12 + casillas vacías | **los 24 + los 2 trajes de Mii** |
| Personajes propios de RR | — | con R / L al lado del nombre (p. ej. Mario (Fire), Mario (Builder)) |
| Vehículos | unos pocos por tamaño | **los 12 de cada tamaño** (karts y motos en una sola lista) |
| Copas | 4 + 4 retro, el resto por ganar | **todas**, en varias páginas (SNES, N64, GCN, Wii U, pistas propias…) |
| Cilindradas | 50/100/150cc, espejo por ganar | 100, 150, 200 y 350cc |

**Por qué:** la wiki de Retro Rewind (mkwiiki.org, "Always-On Features") lista **"Unlock Everything"**, que da el
efecto de tener todo desbloqueado, siempre activo. **No hubo que cambiar nada.** Desde ahora, para saber qué es o
qué trae algo del juego, se consulta primero esa wiki (pedido del dueño).

```bash
node web/navegador/guion.mjs "K:2500 K:2000 K:2500 K:2500 K:2500 K:3000 K:3500 K:2500 K:2500 K:2500 K:3500"
```

### 38. Partidas guardadas en el navegador (y listas para la nube) · 21:20–21:45

**El problema.** El juego escribe sus partidas en el sistema de archivos de mentira de la página (MEMFS), que vive
en la memoria y **se borra al cerrar la pestaña**: cada vez se empezaba de cero.

**Qué escribe el juego** (medido con `guion.mjs --listar` al crear una licencia, mirando qué archivos tienen fecha
posterior al arranque):

| Archivo | Qué es |
|---|---|
| `/mkw/sd/riivolution/save/RetroWFC/RMCP/rksys.dat` (2,8 MB) | la partida: licencias, récords, amigos (la "Separate Savegame" de RR) |
| `/mkw/sd/riivolution/save/RetroWFC/RMCP/banner.bin` | el ícono de la partida |
| `/datos/WiiCompiled/NAND/shared2/Pulsar/RetroRewind6/RRGameSettings.pul` | ajustes de Retro Rewind (más adelante también `RRSettings.pul` = trofeos y `RRRating.pul` = VR) |
| `/datos/WiiCompiled/NAND/title/…`, `shared2/wc24/…` | ajustes de la consola Wii |

**La solución: `web/navegador/guardado.mjs`.**

1. **Al abrir la página** lee de **IndexedDB** (la base de datos del navegador, en el disco) lo guardado y, antes del
   `main()` del juego, lo vuelve a poner en su lugar, encima de la partida vacía que trae el servidor.
2. **Mientras se juega**, se **engancha** a tres funciones del sistema de archivos del juego: cerrar un archivo que
   se escribió, renombrar y borrar. Cuando eso pasa en una carpeta de partidas, anota el archivo y lo copia a
   IndexedDB **medio segundo después del último cambio** (un antirrebote: el juego a veces escribe en varios pasos,
   y así no se guarda a medias). No hace falta revisar los ~6 000 archivos cada tanto: solo se mira lo que el juego
   toca, y no le cuesta tiempo al dibujo.
3. **Al esconder o cerrar la pestaña** guarda enseguida lo pendiente.
4. No guarda temporales (`*.tmp`, el runtime guarda "seguro": escribe un .tmp y lo renombra) ni `Config.toml` (lo
   arma la página).

En "Opciones" de la página: cuántos archivos hay guardados y a qué hora fue el último guardado, **Descargar**,
**Cargar…** y **Borrar partidas guardadas** (pide confirmación). Después de borrar o cargar, el guardado automático
se queda quieto hasta recargar, para que el juego (que todavía tiene la partida vieja en memoria) no la vuelva a
escribir encima.

**Pensado para el sitio (pedido del dueño: todo se piensa para Paginita-Pro, en GitHub Pages, con Firebase).**

- IndexedDB funciona igual en GitHub Pages: es del navegador, no necesita servidor. La base se llama
  `mkw-partidas` para no chocar con las de otras páginas del sitio (todas comparten el mismo origen).
- **Paquete de partidas (`.mkwp`):** todas las partidas en un solo archivo comprimido con gzip (índice + datos;
  `rksys.dat` casi todo ceros queda en pocos KB). Hoy sirve para pasar la partida a otro navegador (Descargar /
  Cargar). En la fase 5 es exactamente lo que se sube a **Firebase Storage** en `mkw/<uid>/partidas.mkwp`, con la
  misma regla de dueño que ya usa el sitio (cada objeto lleva el uid de quien lo subió; solo esa persona lo lee o
  lo pisa; tope de tamaño). Las reglas las publica el dueño a mano, como siempre.
- Al cargar un paquete se revisa todo antes de tocar nada: solo acepta rutas dentro de las carpetas de partidas (un
  archivo malicioso no puede escribir en cualquier lado) y, si está roto, no borra lo que había.
- La página le pide al navegador **almacenamiento persistente** (como BT3 con su caché del disco). Chrome en una
  página nueva lo niega ("no"); por eso la nube en el sitio importa.

**Pruebas:**

- `banco/pruebas/guardado/` (sin el juego): un "juego falso" en C (`archivos.c`, compilado con
  `construir.ps1`) usa el MEMFS **real** de Emscripten y escribe con `fopen`/`fwrite`/`fclose`, `rename`, `remove`,
  el mismo camino que el juego. Se comprueba: guardado medio segundo después; 5 escrituras seguidas = 1 guardado;
  guardado seguro (.tmp + renombrar) guarda solo el final; un fantasma nuevo en la SD se guarda; lo de fuera de las
  carpetas no; leer no dispara nada; borrar borra; al "reabrir" (otro juego falso) todo vuelve encima de la partida
  vacía; el paquete comprime (100 KB → 326 bytes), se carga en otra base igual, uno roto se rechaza sin borrar nada;
  "borrar todo" vacía → **15 bien, 0 mal**.
- `node web/navegador/prueba-partidas.mjs` (con el juego): borra lo guardado, crea una licencia con teclas, espera a
  que se guarde sola (17 archivos), **recarga la página** y comprueba que se restauraron los 17, que la licencia 1
  de `rksys.dat` existe (empieza con "RKPD", según el formato documentado en Tockdom) y que el juego la muestra (la
  casilla 1 cambió de "NEW" a "Player": 30 % de la casilla distinta) → **6 bien, 0 mal**.

```bash
node web/navegador/prueba-partidas.mjs
```

**Falta:** subir y bajar el paquete de Firebase Storage en el sitio (fase 5); que los trofeos y el VR de RR
(`RRSettings.pul`, `RRRating.pul`) se escriban en las carpetas vigiladas cuando aparezcan (se verá al jugar una
contrarreloj y en línea).

### 39. Lo bajado del disco queda en el navegador (caché) · 21:45–21:52

**El problema.** Cada vez que se abría la página, el juego volvía a pedir a la red todos los pedazos del disco que
leía (la pantalla de título sola son ~20 MB; una carrera, bastante más). En el sitio eso es tráfico del Worker y
de R2 en cada visita, y espera para la persona.

**La solución: `web/navegador/disco.mjs`, igual que hace BT3 en el sitio** (su caché `bt3-disco:<tamaño>`):

1. Cada archivo se parte en **bloques de 256 KB**. Una lectura del juego pide los bloques que toca, no los bytes
   sueltos (como una flash leída por páginas).
2. Cada bloque bajado se guarda en **Cache Storage** (en el disco del usuario, sobrevive a cerrar la página) y en la
   memoria (los últimos 64 MB, para no ir ni a Cache Storage).
3. Si faltan varios bloques seguidos, se piden en **un solo pedido** a la red. Si dos lecturas piden el mismo
   bloque a la vez, sale un solo pedido (la segunda espera a la primera).
4. La caché lleva la **versión** de los archivos, que da el servidor en la cabecera `X-Mkw-Version` (huella de
   rutas, tamaños y fechas). Si cambia el disco o se actualiza Retro Rewind, la caché vieja se borra sola.
5. En "Opciones": cuánto ocupa y **Borrar datos del juego en este navegador**.

**Resultado** (prueba del navegador, segunda vez que se abre): **0 pedidos a la red**, 125 bloques de la caché, 85
lecturas del juego. **Hallazgo:** el tirón del segundo 4 del arranque (~37 fps durante un segundo) **sigue igual**
con todo en la caché: no era la red, es trabajo de la CPU del juego al cargar el menú. Los cortes de sonido del
arranque son por ese mismo tirón (quedan pendientes).

**Para el sitio:** R2 acepta pedidos Range, así que el Worker puede servir los bloques igual; debe responder
`Cache-Control: no-store` para que el navegador no guarde todo dos veces (su caché HTTP y la nuestra), como BT3.

**Prueba:** `banco/pruebas/disco/` (sin el juego): un servidor falso con bytes de forma conocida (el byte *i* vale
*i*·7 mod 256) que cuenta los pedidos. Lecturas exactas (chicas, cruzando bloques, pasado el final), un pedido por
tramo, dos lecturas a la vez = un pedido, al "reabrir" 0 pedidos, otra versión borra la vieja, la red caída da error
y después se recupera, tope de memoria, borrar → **15 bien, 0 mal**. Encontró tres errores antes del juego: un
`new Array(n).map` que se salta los huecos, dos lecturas simultáneas que bajaban lo mismo dos veces, y una lectura
que no esperaba a que terminara de guardarse un bloque.

### 40. Primera carrera en el navegador: un cuelgue de WebGPU y cuánto cuesta · 21:52–22:20

**Cómo se llegó.** Con `guion.mjs`: crear licencia → Un jugador → Grand Prix → 150cc → personaje → vehículo →
copa → pista → OK → carrera (19 pasos, ver abajo). Para medir se le agregaron pasos: `K~30000` (mantener A apretado
30 s: acelerar), `P:4000` (un **perfil** de 4 s mientras acelera: en qué funciones se va el tiempo), `Q:4000` (perfil
sin apretar nada, para un menú), `R` (recargar la página). Cada paso ahora escribe en qué **cuadro** terminó, para
saber a qué pantalla corresponde cada línea del medidor.

**El cuelgue.** Al empezar la carrera, Chrome tiraba el error de WebGPU *"maxDepth (1.06) are not in [0, 1]"* y la
imagen se congelaba. El juego (la Wii) a veces pone un viewport con profundidad un poco fuera de 0–1, cosa que la
Wii y Dawn de escritorio toleran, pero **el WebGPU del navegador exige 0 ≤ min ≤ max ≤ 1**. Arreglo en aurora
(`lib/gfx/common.cpp`, solo en la versión web): **limitar** los dos valores a ese rango antes de pasarlos. Como un
recortador a la entrada de un ADC. Va en `parches/aurora-web.diff`.

**Una trampa al medir.** La primera medición dio "~27 fps y ~36 ms por cuadro" y se anotó como "la carrera". Mal:
mirando las fotos de cada paso, ese tramo era **la pantalla de elegir pista** (la del cartel "OK"), antes de que la
carrera cargue. La carrera en sí estaba después. Lección: medir siempre con la foto y el número de cuadro al lado.

**Cuánto cuesta de verdad** (este PC, Ryzen 9800X3D):

| Momento | fps | Trabajo de CPU por cuadro |
|---|---|---|
| Pantalla de título | 60,0 | ~7,3 ms |
| **Elegir pista** (copa → pistas, con el video de la pista de fondo) | **25–28** | **36–41 ms** |
| Presentación de la pista (cámara volando) | 60 | ~11 ms |
| Largada y primeros segundos, 12 karts juntos | 55–60 | 14–17 ms |
| **Carrera** (a los 40 s, 12 karts en el mapa) | **60,0** | **~11 ms** |

O sea: **la carrera va a 60 fps** con margen (11 de 16,7 ms). Lo lento es la pantalla de elegir pista. El perfil
de esa pantalla (`Q:5000`) muestra el tiempo en un grupo de funciones del juego (`func_801B4DA8`, `801B5B74`,
`801B5234`, `801B6858`, `801B61D0`: ~36 %) y en las cargas/guardados cuantizados de "paired singles" (`psq_l`/`psq_st`
con bytes: ~21 %), más subir texturas a la GPU (`writeTexture`, `convert_texture`). Ese dibujo calza con **el video
de vista previa de la pista** (formato THP de Nintendo: un video JPEG que la Wii descomprime con la CPU usando
paired singles, y que cada cuadro se sube como textura). Es lo más probable, sin confirmar.

```bash
node web/navegador/guion.mjs "K:2500 K:2000 K:2500 K:2500 K:2500 K:3000 K:3500 K:2500 K:2500 K:2500 K:3500 K:2500 K:2500 K:2500 K:2500 K:4000 K:12000 K~30000:500 K~40000:500"
```

### 41. Mando táctil: tamaño, opacidad y prueba en un Pixel 7 · 21:58–22:05

**Qué se cambió** (como en BT3):

1. **Tamaño (80–130 %) y opacidad (30–100 %)** ajustables en "Controles" (aparecen solo con el mando táctil
   prendido), guardados en el navegador (`mkw.tactil`).
2. **En el celular, el recuadro del juego ocupa toda la pantalla** (de borde a borde, alto = la pantalla) con la
   imagen centrada; al apretar "Arrancar" la página lo lleva a la vista. Acostado, los botones caen en las franjas
   negras a los costados de la imagen; parado, debajo.
3. Los botones se miden en **cqmin** (1 % del lado más corto del recuadro), así tienen el mismo tamaño parado o
   acostado (antes se medían en % del ancho y, acostado, el stick salía más alto que media pantalla).
4. **Start (▶) arriba a la derecha y de tamaño fijo**; un dedo que cae sobre un botón nunca se toma como stick.

**La prueba: `node web/navegador/prueba-tactil.mjs`.** Abre la página haciéndose pasar por un **Pixel 7** (Chrome
emula la pantalla de 412×915, el táctil y el "puntero grueso", así la página prende sola el mando táctil). Parado y
acostado, y para cada tamaño de 80 % a 130 % de 5 en 5, mide dónde quedó cada botón y comprueba que ninguno pisa a
otro (son redondos: se pisan si la distancia entre centros es menor que la suma de los radios, con 2 px de aire),
que todos caben en la pantalla y que miden al menos 44 px (~7 mm, lo mínimo cómodo para un dedo). Después **toca
de verdad** por CDP (`Input.dispatchTouchEvent`, el navegador cree que hay dedos en el vidrio) cada botón y mira el
mando de GameCube que recibiría el juego; y con dos dedos: A apretado y el stick a la derecha.

**La primera corrida falló (y para eso estaba):** A pisaba a B en todos los tamaños, Start y la cruz medían menos de
44 px, en 115 % el stick pisaba la cruz, y el recuadro no llegaba a los bordes (quedaba dentro del margen de la
página). Se rehízo la distribución (tabla comentada en `controles.mjs`) → **16 bien, 0 mal**, con fotos en
`build/web/datos/tactil-parado.png` y `tactil-acostado.png`. El banco de controles sigue **28/0**.

**Falta:** probarlo en un teléfono de verdad (la emulación no mide el calor ni el rendimiento del celular, ni la
comodidad real).

### 42. Experimento: compilar con SIMD (`-msimd128`) · 22:05–22:25

**Qué es.** SIMD = instrucciones que operan 4 números a la vez (como 4 canales de un mismo amplificador). wasm las
tiene (`simd128`), pero hay que pedírselas al compilador con `-msimd128`; hasta ahora el juego se compilaba sin ellas,
y lo que el runtime escribe como "vectores" (las paired singles de la Wii, de a 2) se hacía número por número.

**Cómo se probó sin molestar.** `compilar-web.py --simd` compila TODO (runtime, juego, aurora) con `-msimd128` en un
taller aparte, `build/web-simd/`, sin tocar el build normal (la otra sesión lo estaba usando). El servidor lo sirve con
`MKW_BUILD=build/web-simd/navegador`, y Node con `MKW_BUILD_NODE=build/web-simd/node`. Compilar las 579 unidades: ~5 min.

**Resultado** (mismo guion, uno después del otro para que no compitan por la CPU):

| Momento | Sin SIMD | Con SIMD |
|---|---|---|
| Elegir pista | 25–28 fps, 36–41 ms | **28–33 fps, 30–36 ms** (~13 % menos trabajo) |
| Carrera (a los 40 s) | 60 fps, ~11,0 ms | 60 fps, ~10,7 ms |
| `.wasm` | 129,7 MB | 130,3 MB |

**¿Cambia algún resultado del juego?** No debe: sumar o multiplicar de a 4 da los mismos bits que de a uno. Se comprobó:

- **Paridad** (`banco/pruebas/paridad`, compilada también con `-msimd128`: `construir.ps1 -Simd`, `prueba-node.mjs
  --simd`): **22 bien, 0 mal**, los mismos bits que x86 en el millón de casos.
- **Arranque en Node** con el build SIMD: **13/0**.
- **Prueba del navegador** con el build SIMD: **20/0** (60 fps, sonido sin cortes, cuadros parejos 98,3 %).
- Comparar el volcado de memoria entre builds **no sirve**: dos corridas del MISMO build ya dan volcados distintos
  (la hora del reloj entra al estado del juego).

Todos los navegadores con JSPI (Chrome/Edge escritorio y Android) tienen SIMD desde 2021: no se pierde a nadie.

**Trampa encontrada de paso:** la prueba de paridad en Node estaba rota sin que se notara: `banco/package.json` (lo
creó npm al instalar Playwright) dice `"type": "commonjs"`, y Node se negaba a cargar `paridad.js` (un módulo ES). Se
agregó `banco/pruebas/paridad/package.json` con `"type": "module"`. Además `construir.ps1` ahora llama a em++ por su
ruta y no falla si no encuentra g++ en el PATH.

**Decisión (22:45): SIMD pasa a ser lo normal.** No cuesta nada y mejora los menús pesados. Se esperó a que la otra
sesión dejara libre el build compartido y se recompiló todo `build/web/` con `-msimd128` (navegador y Node). Para
comparar con el build viejo: `compilar-web.py --sin-simd` compila sin SIMD en un taller aparte, `build/web-sin-simd/`
(servirlo con `MKW_BUILD=build/web-sin-simd/navegador`). **Para que elegir pista llegue a 60** hace falta más: acelerar las cargas/guardados
cuantizados del runtime en wasm, o imitar en nativo el decodificador de video THP (trabajo de fondo, en su propia sesión).

```bash
python herramientas/compilar-web.py --modo navegador              # con SIMD (lo normal desde 22:45)
python herramientas/compilar-web.py --modo navegador --sin-simd   # sin SIMD, para comparar
MKW_BUILD=build/web-sin-simd/navegador node web/navegador/prueba-navegador.mjs 900
```

### 43. ¿Por qué los "cuadros parejos" variaban? La medida miraba lo que no se ve · 21:10–22:30

**El síntoma.** La verificación "cuadros parejos con el monitor (≥ 98 %)" daba entre 82 y 100 % con la misma
compilación (§36). En las corridas malas aparecían pares de cuadros de 3 y 5 refrescos en vez de 4 (monitor de
240 Hz), aunque el PLL decía estar enganchado (error < 0,5 ms en ~99 % de los cuadros).

**Cómo se investigó.** Primero una traza propia (`?traza=1`, ver abajo) con la hora de cada paso de cada cuadro, y
después la **traza de Chrome**: el registro interno donde Chrome anota qué hace su compositor, con un evento
`Display::FrameDisplayed` = "esta imagen se mostró en ESTE refresco". Esa es la verdad de lo que se ve; la página
sola no puede saberla. Lo que salió, en orden:

1. **El juego casi nunca le devuelve el control al navegador.** Entre cuadros el runtime *gira* (espera en un lazo
   apretado, sin ceder: `SleepPreciselyUntil` con tramos de 1 ms nunca llega a dormir). La espera que creíamos
   que mandaba (`PaceToRetraceBoundary`, la que despierta con el rAF, §33) en Mario Kart no se usa nunca: el juego
   se ajusta solo con `VIWaitForRetrace`. El único respiro es una pausa de ~5 ms **dentro de `aurora_end_frame`**:
   aurora espera "su hora de presentar" (retrace + 6,5 ms) con `emscripten_sleep`. En esa pausa corren los rAF, el
   sonido, los controles… y el navegador **toma el canvas** (su "actualización de la pantalla") para el compositor.
2. **La medida vieja contaba otra cosa.** El contador de cuadros sube *después* de `aurora_end_frame`, o sea,
   después de que el `setTimeout` de esa pausa despierta (llega 1–4 ms tarde). La página lo veía recién en la pausa
   del cuadro siguiente, con la hora "vieja" de un rAF atrasado. Ese despertar caía ~1 ms antes de un refresco: un
   atraso de más de 1 ms lo pasaba al refresco siguiente y salía un par 5-3 **que en pantalla no existía**. Por eso
   variaba con la carga de la máquina (más carga → `setTimeout` más tarde).
3. **Y lo que sí se veía estaba peor.** Con la traza de Chrome, la fase de antes (el reloj VI a 0,25 ms de cada
   refresco) daba **50–65 %** de cuadros parejos de verdad (3 corridas con la máquina tranquila: 50,6 / 50,2 /
   65,3 %), mientras la página decía ~99 %. Cada imagen se mostraba 0,8 o 1,8 refrescos después de entregarla, con
   la entrega siempre en la misma fase: el problema era *dónde cae, dentro del refresco, la presentación de Chrome*.
4. **El camino de una imagen** (medido en la traza de Chrome): retrace → +0,6 ms el juego entrega el cuadro a aurora
   (`GXCopyDisp`) → aurora lo codifica, lo manda a la tarjeta y hace su pausa → +1,3–1,5 ms el navegador toma el
   canvas → +0,4 ms el compositor lo dibuja → +1,2–2 ms lo entrega a Windows (`DCompPresenter::Present`) → se ve en
   el refresco siguiente **si** esa entrega llegó antes del refresco. Con la fase de antes, la entrega a Windows caía
   justo encima de un refresco: a veces llegaba y a veces no → 4, 3, 5, 4… Es como muestrear una señal justo en su
   flanco: el resultado salta entre dos valores.

**El arreglo** (`vi.cpp` + `mkw.mjs`):

- El runtime avisa a la página justo antes de entregar cada cuadro (`mkw_web_entrega(retrace)`), y la página anota
  cuándo toma el canvas (el primer rAF después). Con la mediana de retrace→toma de los últimos 4 s calcula en qué
  fase debe ir el reloj VI para que la **toma caiga a la mitad del refresco menos 2 ms** (lo que tarda el
  compositor): así la presentación queda a mitad de camino entre dos refrescos, lo más lejos posible de los dos
  flancos. El runtime pide esa fase en cada cuadro (`mkw_web_vsync_objetivo`) y el PLL la sigue.
- **Banda muerta de 0,3 ms**: la fase solo se mueve si la nueva difiere en más de 0,3 ms. Sin ella, el ruido de la
  medida la hacía pasear 2 ms en pocos segundos, y eso mismo causaba tirones (lo vi en una corrida: 95,8 %).
- Probé también usar el aviso de la tarjeta "terminé de dibujar" (`onSubmittedWorkDone`): no mejora (en esta
  tarjeta el dibujo termina antes que la toma) y sus avisos llegan con atrasos irregulares que hacían pasear la
  fase. Se quitó. Se quitó también la cuenta de "trabajo por cuadro" de `MkwVsyncTargetMs`, que nunca recibía datos.
- Para comparar quedan `?faseVi=0.25` (la fase fija de antes) y `?toma=X` (la toma a X ms del refresco).

**La prueba ahora mira la pantalla.** `prueba-navegador.mjs` graba, pasado el cuadro 480, hasta 8 s de la traza de
Chrome con **una sola categoría** (la de `Display::FrameDisplayed`; grabar muchas carga a Chrome y empeora lo que
se mide) y verifica **"cuadros parejos en pantalla (≥ 90 %)"**; en el log deja la "película" (un punto por imagen
pareja, el número de refrescos si no). La verificación de la página pasó a ser solo un dato ("tomas parejas"),
porque la página no puede ver la pantalla: daba 100 % incluso con la fase de antes.

**Resultados** (todas en este PC: RTX 3080 Ti, monitor de 240 Hz; Chrome sin ventana):

| | Cuadros parejos en pantalla |
|---|---|
| Fase de antes (`?faseVi=0.25`), máquina tranquila | 50,6 · 50,2 · 65,3 % |
| Arreglo, trazas sueltas de 10 s, máquina tranquila (12 corridas, varias tomas) | 11 de 12 ≥ 98 % (la otra 94,7 %) |
| Arreglo, prueba completa, 21 corridas a lo largo de 40 min | 9 ≥ 98 %, 9 entre 90 y 98 %, 3 < 90 % |
| Arreglo, prueba completa, últimas 4 corridas (máquina tranquila) | 100 · 99,2 · 99,2 · 100 % |

**¿Por qué el mínimo es 90 % y no 98 %?** Porque lo que queda no lo controla el juego. Las fallas vienen en
"ráfagas" de unos segundos y siguen el estado del PC, no la compilación: en esas corridas había a la vez otro Chrome
con el juego (pruebas de otras sesiones), una compilación usando los 16 núcleos y el compositor de Windows (DWM) al
~37 % con dos monitores en dos tarjetas (240 Hz en la NVIDIA, 144 Hz en la AMD). Mover la toma de lugar no cambia
nada (probé 0,08 / 0,6 / 2,9 / 3,4 ms: todas 95–100 %): son demoras de 2 ms o más de Chrome y Windows al presentar,
y a 240 Hz cada refresco dura solo 4,17 ms. Con 90 % la prueba separa de sobra "arreglado" (casi siempre 90–100 %) de
"roto" (50–65 %); si falla con 80–90 %, repetirla con el PC tranquilo. En un monitor de 60 Hz (16,7 ms por
refresco) estas demoras no alcanzan para mover un cuadro.

**La GPU:** cambiar de la AMD a la NVIDIA a mitad del día cambiaba cuánto tarda el compositor y, con la fase fija de
antes, dónde caía la presentación. Con la fase que se mide sola ya no importa qué tarjeta toque (solo se probó la
NVIDIA: el navegador ya no deja elegir la AMD, §36).

**La traza propia** (`?traza=1`, para depurar; apagada no cuesta nada): el runtime marca cada cuadro (antes y después
de `aurora_end_frame`, inicio de cuadro, despertares) y la página guarda también cada rAF y cada espera; al final lo
vuelca en líneas `[traza]`, y `herramientas/analizar-traza.mjs` dice dónde cae cada paso dentro del refresco.

```bash
node web/navegador/prueba-navegador.mjs 1200                  # la prueba (20 puntos, uno con la traza de Chrome)
node web/navegador/prueba-navegador.mjs 1200 --extra "&traza=1" && node herramientas/analizar-traza.mjs
node web/navegador/prueba-navegador.mjs 1200 --extra "&faseVi=0.25"   # la fase de antes, para comparar
```

**Trampas:** (1) no correr pruebas de ritmo con otro Chrome con el juego abierto ni compilando: la medida cambia;
(2) la hora que da rAF puede ser "vieja" (de un refresco anterior) cuando el hilo estuvo ocupado: no sirve para
saber cuándo se mostró algo; (3) la traza de Chrome con muchas categorías empeora el ritmo que mide.

**Lo que queda:** el runtime gira entre cuadros en vez de ceder (gasta un núcleo entero y el navegador solo respira
en la pausa de aurora). Hacer que espere cediendo (con el rAF, como pensaba §33) liberaría la CPU y podría bajar
esas demoras; es un cambio grande, para su propia sesión.

### 44. Repaso de todas las pruebas y dos arreglos chicos · 22:25–22:45

Al final de la tanda se corrieron todas las pruebas, con el build normal (sin SIMD):

| Prueba | Comando / página | Resultado |
|---|---|---|
| Controles (sin el juego) | `banco/pruebas/controles/` | 28/0 |
| Caché del disco | `banco/pruebas/disco/` | 15/0 |
| Partidas (MEMFS real) | `banco/pruebas/guardado/` | 15/0 |
| Sonido (sin el juego) | `banco/pruebas/sonido/` | 13/0 |
| Paridad x86 ↔ wasm | `banco/pruebas/paridad/` (y `prueba-node.mjs`) | 22/0 |
| Arranque en Node | `node web/node/prueba-arranque.mjs` | 13/0 |
| El juego en Chrome | `node web/navegador/prueba-navegador.mjs 900` | 20/0 (tres veces seguidas) |
| Partidas con el juego | `node web/navegador/prueba-partidas.mjs` | 6/0 |
| Mando táctil (Pixel 7) | `node web/navegador/prueba-tactil.mjs` | 16/0 |

**Arreglo 1 — la prueba del sonido fallaba a veces** ("sonaba sin gesto", 1 de cada ~4 corridas). Con
`?bloquearSonido=1` la página arranca el sonido suspendido, como haría Chrome con una persona. Pero SDL3 también
intenta `resume()` por su cuenta, y bajo Playwright cualquier `evaluate()` (con el que la prueba lee el estado) cuenta
como "gesto de la persona": a veces SDL3 lo desbloqueaba antes del clic. Ahora, con el bloqueo simulado, `resume()` no
hace nada hasta que la página vio un gesto de verdad (toque, clic o tecla). Es como un relé con enclavamiento: solo
el pulsador de la página lo cierra. En la página real (sin el parámetro) no cambia nada.

**Arreglo 2 — un "error sin atender" del disco.** Si la red falla mientras se baja un bloque, la promesa interna que
comparten las lecturas simultáneas quedaba rechazada sin que nadie la atendiera, y el navegador mostraba
"HTTP 503" como error suelto en la consola (lo vio la página del banco). Se marca como atendida; quien sí espera esa
lectura sigue recibiendo el error. (Una **promesa** es un "vale" por un resultado que llega después; si ese resultado
es un error y nadie lo mira, el navegador avisa.)

Los parches de `parches/` siguen coincidiendo con los cambios en `terceros/Wiicompiled` (aurora idéntico; el runtime
solo difiere en los dos archivos nuevos, que la receta del README agrega aparte).

### 45. Partidas en la nube (Firebase Storage), probadas con una nube falsa · 23:20–23:45

**Qué se quería** (fase 5, pedido del dueño: pensar todo para el sitio en GitHub Pages con Firebase): que la partida
siga a la persona. Si juega en el computador y después entra desde el celular con su cuenta de Google, la partida
debe estar ahí.

**Cómo funciona: `web/navegador/nube.mjs`.** Las partidas ya se guardan solas en el navegador (§38) y se pueden
empaquetar en un solo archivo comprimido (`.mkwp`). La nube guarda ese paquete en Firebase Storage, en
`mkw/<uid>/partidas.mkwp` (un archivo por persona; el uid es el número de identidad que Firebase le da a cada
cuenta). Cada paquete lleva pegados unos **metadatos**: quién lo subió, su **huella** (SHA-256 del contenido: si
cambia un byte, cambia toda) y **cuándo se jugó** (la hora del archivo más nuevo). Además, cada navegador recuerda
la huella de la última vez que quedó igual a la nube.

Al entrar a la página, antes de que el juego lea las partidas, se comparan tres huellas (la local, la de la nube y la
recordada), sin bajar nada:

| Local \ Nube | no hay nada | igual que la última vez | cambió (otro aparato subió) |
|---|---|---|---|
| no hay nada | nada | bajar | bajar |
| igual que la última vez | subir | nada | bajar |
| cambió (se jugó aquí) | subir | subir | **conflicto** |

**Conflicto** = se jugó en los dos aparatos sin conexión. Gana la partida **jugada más recientemente** (no la
subida más recientemente: una partida vieja se puede subir tarde), y **la otra queda de respaldo** para descargarla.
Nunca se pisa una partida sin quedarse con una copia, como un control de versiones de un solo archivo.

Mientras se juega, cada vez que el guardado escribe algo se sube el paquete unos segundos después (espera para juntar
varias escrituras) y nunca más de una vez cada 30 s. Al esconder la pestaña (cambiar de app en el celular) se intenta
subir enseguida. Si no hay conexión, se juega con lo local y se sube después. El paquete pesa pocos KB.

**Firebase entra por un adaptador de tres funciones** (`meta`, `bajar`, `subir`). `almacenFirebase()` lo arma con el
SDK que ya usa el sitio (`juegos/hero/js/cloud.js`: Firebase 10.12.2 del CDN de Google, inicio de sesión con Google,
App Check). La prueba usa uno falso. Así todo se prueba sin internet ni cuenta.

**La regla de Storage** está escrita en `docs/firebase-mkw.md`, junto con el código para la página del sitio: solo
la persona dueña (uid de la ruta = uid de la sesión) lee o escribe, el objeto debe decir su uid, nada de HTML/JS y
tope de 8 MB. **La publica el dueño a mano**; no se subió nada.

**Prueba: `banco/pruebas/nube/`.** Dos "navegadores" (A y B, cada uno con su IndexedDB real y su memoria) y un
Firebase Storage falso que **aplica las reglas**. Las partidas son falsas con la forma de las del juego. Se comprueba:

- sin sesión no se toca la nube;
- A sube (el paquete de 64 KB pesa ~1 KB) y B baja: quedan iguales;
- sin cambios solo se leen los metadatos;
- 3 avisos de guardado seguidos dan 1 sola subida, con un tope de frecuencia;
- sin conexión se juega local y se sube al volver;
- conflicto en los dos sentidos, con el respaldo correcto (se puede volver a cargar);
- otro aparato que subió mientras se jugaba queda de respaldo;
- las reglas rechazan a otra persona, un uid falso y el exceso de tamaño, y el error se informa sin tocar lo local;
- un paquete dañado en la nube no borra nada;
- el adaptador llama a las funciones correctas del SDK (`getMetadata`, `getBytes`, `uploadBytes` con `customMetadata`).

Resultado: **23 bien, 0 mal**.

**Trampa encontrada por la prueba:** la primera versión decidía los conflictos con la hora de **subida**. A jugó
primero y subió después; B jugó después y entró más tarde, y ganó A (lo viejo). Se agregó el metadato `jugado` y el
conflicto compara hora de juego con hora de juego.

**Falta (fase 5):** conectarlo en la página del sitio (`juegos/mkw/`) con el inicio de sesión real, y publicar la regla.
La página local de pruebas no tiene Firebase: ahí todo sigue en el navegador.

### 46. Salas de Retro WFC en vivo y el código de amigo · 23:45–23:55

**Qué es.** Retro WFC es el servidor en línea de la comunidad que usa Retro Rewind (el de Nintendo cerró). Publica el
estado de todas sus salas en `https://rwfc.net/api/roomstatus`: un JSON con cada sala, su tipo, la pista que se está
corriendo y sus jugadores (nombre, código de amigo, VR, Mii), renovado cada ~10 s. Para la página del juego en el
sitio (fase 6) sirve para mostrar "quién está jugando ahora" y buscar a un amigo.

**¿Hace falta el Worker?** El plan decía "vía el Worker si hace falta CORS". Medido: Retro WFC responde
`Access-Control-Allow-Origin: *`, así que la página en GitHub Pages lo lee directo. **No hace falta el Worker.**

**`web/navegador/salas.mjs`:**

1. **`normalizar`** deja el JSON en una forma simple: quita las salas vacías (quedan colgadas en el servidor), ordena
   por cantidad de jugadores y traduce lo claro: `private` es una sala de amigos y `anybody` una abierta. Qué
   significan los `rk` (`vs_10`, `vs_20`) no está en la wiki ni en Tockdom, así que se muestran tal cual; no se inventa.
2. **`crearSalas`** pregunta cada 15 s mientras la pestaña está a la vista (escondida no gasta datos ni batería). Si
   falla, espera el doble cada vez, hasta 2 min.
3. **El código de amigo.** No es un número al azar. Según Tockdom ("Friend Code"), son las 12 cifras de: el **pid**
   (el número del jugador) más 7 bits de control, que salen del **MD5** de (pid + el código del juego "RMCJ" al
   revés). Funciona como el dígito verificador del RUT: si alguien escribe mal una cifra, se nota sin preguntarle a
   nadie. `codigoValido` lo revisa y `buscarAmigo` encuentra en qué sala está. El navegador no trae MD5 en
   `crypto.subtle`, así que se escribió según el algoritmo público (RFC 1321). La lógica es una reimplementación
   desde la documentación, no código de WheelWizard (que es GPL).

**Verificación de la fórmula:**

- En Python, con los 280 jugadores en línea a las 23:47: 280/0 coinciden.
- Con el módulo en Node contra el servidor real: 270 de 270 códigos válidos.
- Esos datos reales solo se midieron, **no se guardaron** (son de personas reales). El banco usa datos inventados.

**Prueba: `banco/pruebas/salas/`.** Un Retro WFC falso con la misma forma que el JSON real, pero jugadores
inventados. Se comprueba:

- el MD5 contra los vectores del RFC;
- 4 códigos contra una referencia calculada aparte con Python;
- que un código con una cifra cambiada se rechaza, y que valen los formatos con guiones, espacios o pegado;
- el filtrado y orden de las salas, y los datos de cada jugador;
- la búsqueda de un amigo;
- que un JSON roto no rompe nada;
- el sondeo: si falla, reintenta más espaciado; con la pestaña escondida no pregunta; al volver pregunta enseguida.

Resultado: **19 bien, 0 mal**. La página también dibuja la tabla de salas para verla.

**Falta (fase 5–6):** mostrarlo en la página del juego en el sitio (panel "En línea ahora" y "Buscar amigo").
Mostrar el código de amigo propio sale de la partida (`rksys.dat`, formato de Tockdom), y queda para cuando se lea la
licencia.

### 47. Elegir pista a 60 fps: el video THP, decodificado en nativo · 22:55–23:55

**El problema.** La pantalla de elegir copa y pista iba a 24–31 fps (36–42 ms de trabajo por cuadro, presupuesto
16,7 ms). El perfil decía que ~36 % del tiempo se iba en cinco funciones del juego (`801B4DA8`, `801B5B74`,
`801B5234`, `801B6858`, `801B61D0`) y ~21 % en las cargas/guardados cuantizados del runtime (`PPC_PsqL`,
`PpcStorePairPsqQuantizedFastInline<unsigned char>`, `PPC_PsqLKnownResolvedFallback`, `PPC_PsqStStateFallback`).

**Paso 1 — ¿qué son esas funciones?** El traductor guarda una tabla con el nombre de cada función del juego
(`generated/guest_symbol_table.cpp`, dos listas paralelas: direcciones y nombres). Con ella:

| Dirección | Nombre | Qué hace (según el formato JPEG público) |
|---|---|---|
| `801B3BAC` | `THPVideoDecode` | decodifica UN cuadro de video THP en tres texturas (Y, U, V) |
| `801B4DA8` | `__THPInverseDCTNoYPos` | IDCT de los bloques (paired singles con cuantización) |
| `801B5234` | `__THPInverseDCTY8` | IDCT, otra variante |
| `801B5B74` / `801B61D0` / `801B6858` | `__THPHuffDecodeDCTCompY/U/V` | leer los códigos de Huffman de cada componente |

O sea: era el video THP, como se sospechaba. Mirando los archivos del disco (solo en esta PC, nada se publica): los
videos van a **59,94 cuadros por segundo** (uno nuevo en cada cuadro del juego) y el de elegir copa
(`thp/course/cup_select.thp`) es de **672×736**, grande. Los de cada copa (`banana.thp`, `kinoko.thp`…) son de
400×576. Cada cuadro es un JPEG de línea base 4:2:0 (marcadores SOI, 2×DQT, SOF0, 4×DHT, SOS) **sin el relleno
0xFF00** (los bytes 0xFF de los datos van seguidos de cualquier cosa, no de 0x00). Todo eso es el formato público; no
se copió código de Nintendo.

**Paso 2 — Línea base** (mismo guion de teclas hasta elegir pista; copia propia del guion en el puerto 8149 para no
chocar con otra sesión):

| Build | Elegir pista |
|---|---|
| Antes (SIMD) | 24–31 fps, 36–42 ms |

**Paso 3a — psq_l / psq_st sin desvíos (probado y DESHECHO).** En la Wii, `psq_l`/`psq_st` cargan y guardan dos
números convirtiéndolos en hardware según el GQR (ver glosario). El IDCT del THP carga enteros de 16 bits y guarda
bytes con escala 61 (= ÷8 y recorte a 0..255). ¿Por qué caían en funciones "de reserva" (fallback)? El traductor
emite una versión "resuelta" que recibe un puntero directo a la memoria (`resolvedHost`), calculado por
`ResolveRangeHost`. En la PC ese puntero existe; **en wasm siempre es nulo** (no hay memoria plana, §15). Y con
puntero nulo, cada carga hacía: llamar a `PPC_PsqL` (fuera de línea) → buscar el contexto del hilo → llamar a
`PPC_PsqLStateFallback` (otra llamada) → recién ahí leer.

Se probó (en `ppc_isa_quantized.h`, solo para wasm) ir directo a las versiones **en línea** que ya existían
(`PPC_PsqLStateInline`, `PPC_PsqLKnownInline` y sus gemelas de guardar): el mismo cálculo, sin las llamadas, y la
escala `2^n` armada con sus bits en vez de llamar a `ldexp`. Resultados exactos (mismos bits), pero al medir:

| Build (con THP nativo en los dos) | Elegir pista | Carrera (últimos 20 s, misma PC tranquila) |
|---|---|---|
| Sin el atajo de psq | 60 fps | 60 fps, **~11,5 ms** |
| Con el atajo de psq | 60 fps | 60 fps, ~13,1 ms (**+14 %**) |

(Sin el THP nativo, el atajo solo bajaba elegir pista un 8 %: 33–39 ms.) ¿Por qué empeora la carrera? El "switch" de
conversión quedaba copiado **en cada uno de los miles de lugares** del juego que usan `psq_l`/`psq_st`: el programa
crece y las funciones grandes se optimizan peor en V8 (más registros en juego, menos caben en la caché de
instrucciones). Es como poner un filtro completo en cada rama de un circuito en vez de uno compartido: cada rama
queda más rápida sola, pero el conjunto ocupa más y rinde menos. **Decisión: se deshizo**; la cabecera quedó igual que
antes (el parche `runtime-web.diff` no cambió). Para comparar se agregó a `compilar-web.py` la variable
`MKW_CFLAGS_EXTRA` (opciones extra para un taller aparte): así se compiló el build "sin atajo" con una macro.
Queda como idea: dejar en línea SOLO el caso float (el común) y llamar fuera de línea para los cuantizados.

**Paso 3b — texturas.** `writeTexture` + `convert_texture` (subir las tres texturas a la GPU y desembaldosarlas) suman
~1,2 ms por cuadro. El video cambia en cada cuadro, así que no hay subidas repetidas que ahorrar: se dejó así.

**Paso 3c — decodificador nativo.** `web/thp/thp_decodificador.cpp`, escrito desde cero con el estándar JPEG (T.81):

1. **Huffman** con un registro de 64 bits que se rellena de a 8 bytes y una tabla de 512 entradas que reconoce de un
   vistazo los códigos de hasta 9 bits (los más comunes); los largos se buscan por largo.
2. **Descuantizar** multiplicando por la tabla, que ya trae metidos los factores de la IDCT rápida.
3. **IDCT AAN** con vectores de 4 floats (SIMD de wasm): 8 filas × 2 vectores, una pasada por columnas, trasponer,
   una por filas, trasponer. Los bloques que solo tienen promedio (DC) se llenan con un solo valor (mismo resultado).
4. **Guardar** directo en baldosas de 8×4: las filas 0–3 de un bloque son una baldosa entera (32 bytes seguidos) y
   las 4–7, la de abajo.

`web/thp/thp_nativo.cpp` lo engancha al juego **sin volver a traducir**: `compilar-web.py` busca el shard donde vive
`func_801B3BAC` (por la marca `#line 1 "func_801B3BAC.cpp"`), lo compila con
`-Dfunc_801B3BAC=func_801B3BAC_traducida` y nuestro archivo define `func_801B3BAC`: todas las llamadas del juego
(directas y por tabla) llegan al nativo. El nativo:

- copia 128 KB desde la dirección del cuadro (si no alcanzan, 4 veces más: el tamaño no llega como argumento);
- decodifica en memoria propia y escribe las tres texturas en la memoria de la Wii de a 4 KB, con la **misma regla de
  permiso** que usan las escrituras del juego (`TryGetWritablePointerFast`; si un pedazo no se puede, va byte a byte
  por el camino normal), y avisa a las cachés de texturas de aurora (`GxGuestWrite::NotifyWrite`) que esa memoria
  cambió;
- devuelve 0 (bien). Si algo es raro (un puntero nulo, un JPEG que no es como los THP: progresivo, 4:4:4, con
  reinicios…), llama a la función traducida, que da sus propios códigos de error.

`?thp=traducido` en la página usa la función del juego como antes; `?thp=comparar` corre las dos en cada cuadro, deja
la imagen de la traducida y anota en la consola cuánto tarda cada una y cuánto difieren.

**Banco** (`banco/pruebas/thp/`, cuadros FALSOS): la página trae su propio codificador JPEG (tablas de ejemplo del
anexo K de T.81) que arma cuadros estilo THP con imágenes sintéticas (degradados, círculos, franjas finas, ruido,
zonas en 0 y 255). Como el codificador sabe qué guardó, calcula la imagen que DEBE salir con la IDCT exacta (la
fórmula directa en doble precisión). **8 bien, 0 mal**: 672×736, 400×576 y 16×16 iguales a la exacta (máx. ±1),
baldosas en su lugar, datos cortados → "falta entrada", basura → "corrupto" sin colgarse, 4:4:4 → "no soportado", y
**0,86 ms por cuadro de 672×736**.

**Comparado con el original, en el juego** (`?thp=comparar`, todos los videos de los menús; medido con el atajo de psq todavía puesto, así que el traducido sin él es algo más lento):

| Video | Traducido | Nativo | Bytes idénticos |
|---|---|---|---|
| 672×736 (elegir copa) | 9,3–9,7 ms por cuadro | 0,9 ms | 90,8 % (el resto casi todo ±1) |
| 512×512, 496×384, 352×256 (otros menús) | 2,3–5,3 ms | 0,25–0,56 ms | 92–95 % |

Dos hallazgos:

- Con redondeo al más cercano, el nativo daba en promedio **+0,49** niveles más: el decodificador del juego
  **trunca** (corta los decimales). Ahora el nativo también trunca (`kRedondeo = 0`): promedio 0,0000.
- Quedan píxeles sueltos (0,1–1 %) con diferencias de 8 a 24 niveles, siempre en **pares**, en las posiciones 3 y 4
  del bloque (filas o columnas) y con signo opuesto. Para saber cuál de los dos se aparta, se pasó un cuadro real de
  `cup_select.thp` por libjpeg (Pillow, en esta PC, agregándole el relleno 0xFF00 para que sea un JPEG normal): el
  nativo da **98,7 % idéntico a libjpeg y el resto ±1**, sin ninguna diferencia grande. O sea, esos pares vienen de una
  aproximación del IDCT del propio juego (su forma de hacer las cuentas con paired singles), no de un error nuestro.
  A la vista no se distingue (las fotos con uno y otro son iguales).

**Resultado:**

| Build | Elegir pista |
|---|---|
| Antes | 24–31 fps, 36–42 ms |
| THP nativo | **60 fps, 13,1–15,0 ms** |

Por qué el traducido costaba ~20 ms de cuadro si decodificar uno tarda ~9,5 ms: a 25 fps el video (que va a 60) se
atrasa, y el reproductor del juego decodifica dos cuadros por cada cuadro mostrado para alcanzarlo.

**Pruebas** (build final del taller `build/web-simd`, SIMD como el normal, sin el atajo de psq):

- Paridad x86 ↔ wasm (`construir.ps1 -Simd`, `prueba-node.mjs` y `--simd`): **22/0 y 22/0**
- Banco THP (`banco/pruebas/thp`): **8/0**
- Arranque en Node (`MKW_BUILD_NODE=build/web-simd/node node web/node/prueba-arranque.mjs`): **13/0**
- El juego en Chrome (`MKW_BUILD=build/web-simd/navegador node web/navegador/prueba-navegador.mjs 900`): **20/0**
  (60,0 fps, máximo 7,7 ms, cuadros parejos en pantalla 99,4 %)
- Elegir pista (guion + perfil `Q:5000`): **60 fps, 13,1–15,0 ms**; en el perfil, `func_801B3BAC` (el nativo) ~5 %
- Carrera (guion hasta largar y acelerar 40 s): **60 fps, ~10,4–10,9 ms** a los 40 s (igual que antes: el THP no corre en la carrera)

**Trampas:**

- La memoria de wasm no es plana: todo lo que en la PC usa un puntero directo, aquí cae en el camino "de reserva".
  Vale la pena buscar más casos así en el perfil (cualquier `…Fallback` que aparezca arriba).
- `banco/package.json` dice CommonJS: la carpeta de la prueba necesita su `package.json` con `"type": "module"`
  (igual que la de paridad, §42).
- Buscar el shard por `extern "C" void func_801B3BAC(` encontraba 3 (también las **declaraciones** de las tablas de
  despacho y de registro); la definición se reconoce por la marca `#line 1 "func_801B3BAC.cpp"`.
- Medir con otra sesión compilando da números inflados (una carrera dio 13–16 ms con ninja corriendo). Y un cambio
  que mejora una pantalla puede empeorar otra: medir siempre también la carrera, con A/B en la misma PC tranquila.
- Mientras el atajo de psq estuvo en el parche, otra sesión tenía cambios a medio hacer en `vi.cpp`: en vez de
  regenerar todo `runtime-web.diff`, se cambió solo la sección de `ppc_isa_quantized.h` (comprobado con
  `git apply --check` sobre una copia limpia). Al deshacerlo se volvió a la copia exacta de antes.

```bash
python herramientas/compilar-web.py --modo navegador --carpeta build/web-simd
powershell -ExecutionPolicy Bypass -File banco/pruebas/thp/construir.ps1
node banco/pruebas/thp/prueba-node.mjs
MKW_BUILD=build/web-simd/navegador node web/navegador/servidor.mjs
```

(Después, abrir http://127.0.0.1:8140/?thp=comparar para ver las dos versiones lado a lado en la consola.)

### 48. El juego espera cediendo, ya no girando · 22:45–00:05

**El problema** (quedó anotado en §43). Entre un cuadro y el siguiente el runtime esperaba la próxima "tele"
(retrace) **girando**: el bucle de espera del juego (`os_scheduler.cpp`) llama a `VI_HLE_WaitForNextRetracePoll`
cada ~1 ms, y esa función esperaba ese milisegundo preguntando la hora sin parar. Resultado: el hilo principal de la
página ocupado ~80 % del tiempo (un núcleo entero), y el navegador solo podía respirar en la pausa de aurora.

**Primer intento, y por qué falló.** Dormir de a 1 ms cediendo el control (con `setTimeout`) y girar solo el último
1,5 ms. Ahorraba CPU (≈ 50 % ocupado), pero los cuadros parejos en pantalla bajaron a 71–93 %. La causa: ahora la
página también corre entre cuadros, así que en cada refresco el navegador hace su "actualización de la pantalla". Si
justo caía un refresco en el rato en que el juego estaba ocupado (los 1,5 ms de giro más la entrega del cuadro),
quedaba una actualización atrasada y el navegador tomaba el canvas apenas el juego cedía; si no, lo tomaba en el
refresco siguiente. Unas veces una cosa y otras la otra → otra vez 3-5-3-5. (Además rompió dos verificaciones: la
foto del canvas salía negra, ver abajo.)

**Lo que quedó** (`vi.cpp` + `mkw.mjs`), que es lo que §33 quería desde el principio:

- Mientras falta para la tele, el juego le pide a la página `esperaHasta(vencimiento)`: "despiértame con el refresco
  justo antes del vencimiento, o en 1 ms para atender el sonido y las alarmas". Desde ese refresco gira solo la fase
  del reloj, **0,75 ms** (`FASE_CEDER`).
- **El juego se despierta en una tarea nueva**, no dentro del rAF. Si siguiera dentro del rAF, entregaría su cuadro
  en medio de la actualización de la pantalla y el navegador lo tomaría en ese mismo refresco, ya tarde para el
  compositor. Despertando después, el cuadro se entrega ~1,5 ms después del refresco y el navegador lo toma
  **siempre** en el refresco siguiente; el compositor lo presenta ~2 ms después: a la mitad del refresco a 240 Hz.
  Es como sincronizar un flip-flop: el dato se prepara con tiempo y se "captura" siempre en el mismo flanco del reloj.
- Los avisos de servicio de 1 ms también salen de una tarea nueva: Chrome alarga a 4 ms los `setTimeout`
  encadenados (uno pedido desde otro más de 5 veces seguidas), y así cada uno empieza una cadena nueva.
- Con esto la fase ya no necesita medirse sola (§43): queda fija. La fase que se mide sola sigue para `?ceder=0`.
- En Node, o con `?ceder=0` o `?enganche=0`, el juego gira como antes.

**Las fotos del canvas.** Las verificaciones "hay imagen" y "el juego responde al botón A" copiaban el canvas en
cualquier momento. Antes eso caía siempre en la pausa de aurora, con el cuadro recién entregado. Ahora la página
también corre cuando el canvas ya se presentó, y WebGPU lo deja vacío para leerlo: salía negro. Arreglo:
`fotoCanvas()` saca la foto dentro del rAF de la toma, cuando el cuadro nuevo todavía está.

**Medida de la CPU.** `prueba-navegador.mjs` ahora también dice qué parte del tiempo estuvo ocupado el hilo principal
de la página durante la medición (CDP `Performance.getMetrics`, `TaskDuration`).

**Resultados.** Comparación A/B intercalada (cediendo, girando, cediendo…), 4 + 4 corridas completas, cada una
esperando a que no hubiera otro Chrome de pruebas ni una compilación:

| | Hilo principal ocupado | Cuadros parejos en pantalla | Prueba |
|---|---|---|---|
| Cediendo (nuevo) | 40 · 38 · 35 · 37 % | 98,8 · 97,1 · 99,2 · 96,7 % | 20/0 las 4 |
| Girando (`?ceder=0`) | 80 · 81 · 80 · 81 % | 98,3 · 94,2 · 100 · 97,5 % | 20/0 las 4 |

La mitad de la CPU, sin perder nada en el ritmo. Node 13/0. Con la traza propia (`?traza=1`): el cuadro se entrega
en la fase 0,3–0,5 del refresco y el navegador lo toma en la fase 0,0–0,1 del siguiente en el 97 % de los cuadros.

```bash
node web/navegador/prueba-navegador.mjs 1200                    # cediendo (lo normal)
node web/navegador/prueba-navegador.mjs 1200 --extra "&ceder=0"  # girando, para comparar
```

**Trampas:** (1) dentro de un rAF, una promesa que se cumple sigue corriendo ANTES de que el navegador termine esa
actualización de la pantalla (las "microtareas" corren apenas termina cada función): para despertar después hay que
pasar por una tarea nueva (`MessageChannel`); (2) el `setTimeout` encadenado se alarga a 4 ms; (3) la foto del
canvas WebGPU solo sirve dentro del rAF en que se toma el cuadro.

### 49. Repaso final con todo junto (SIMD + THP nativo + esperas que ceden) · 00:05–00:11

Esa noche trabajaron tres sesiones a la vez sobre la misma carpeta:

- esta, con el táctil, la nube, las salas y SIMD;
- la de los cuadros parejos (§43 y §48);
- la de elegir pista (§47).

Cada una compiló en su propio taller (`compilar-web.py --carpeta …`) para no pisarse. Al final se juntó todo en el
build normal (`build/web/`, con SIMD) y se corrió **todo** con el PC tranquilo (sin otra compilación ni prueba a la
vez, porque las medidas de tiempo se ensucian):

| Prueba | Resultado |
|---|---|
| Banco: capacidades, fibers, excepciones, fma, webgpu | 15/0, 4/0, 4/0, 5/0, 10/0 |
| Banco: paridad (página y Node, con y sin SIMD) | 22/0 (×3) |
| Banco: controles, disco, guardado, sonido | 28/0, 15/0, 15/0, 13/0 |
| Banco: nube, salas, THP | 23/0, 19/0, 8/0 |
| Arranque en Node | 13/0 |
| El juego en Chrome | 20/0 dos veces: 99,4 % y 100 % de cuadros parejos en pantalla; hilo principal ocupado 35–36 % |
| Partidas con el juego | 6/0 |
| Mando táctil (Pixel 7) | 16/0 |

**Cuánto cuesta cada pantalla ahora** (guion de 19 pasos, mismo PC):

| Pantalla | Antes de esta noche | Ahora |
|---|---|---|
| Elegir pista | 25–28 fps, 36–41 ms | **60 fps, 12–14 ms** |
| Presentación de la pista | 60 fps, ~11 ms | 60 fps, ~9,5 ms |
| Carrera (12 karts) | 60 fps, ~11 ms | **60 fps, ~10 ms** |
| Largada (primeros ~2 s) | 55–60 fps | 19–46 fps durante ~2 s, después 60 |

Lo que queda: **el tirón de la largada**. Unos 2 s a 19–46 fps justo al empezar la carrera, cada vez que se entra a
una pista. Lo más probable es lo mismo que el tirón al entrar al menú: gráficos que WebGPU arma la primera vez que
se usan (pipelines). Queda anotado en el PLAN para medirlo y precalentarlo.

Los parches de `parches/` coinciden con lo que hay en `terceros/Wiicompiled` (`git apply --check -R` limpio en
`runtime-web.diff` y `aurora-web.diff`). `git status` no muestra nada del juego. No se hizo ningún commit.

### 50. El tirón de la largada (1): buscar archivos en el índice del disco · 00:25–00:55

**El síntoma.** Al empezar cada carrera, ~2 s a 19–46 fps (§49). Para encontrar la causa se usó el guion
(`guion.mjs`) hasta la largada, con el medidor por segundo y la lista de pedidos a la red (`[red] …`) en el mismo
registro.

**Lo primero que apareció: ~9.300 búsquedas de nombres de archivo en una ráfaga.** Al cargar una carrera, Retro
Rewind prueba cada voz posible de cada personaje (`/sound/GRP_VO_<personaje>_<grupo>.brwsd`, `.brbnk.<variante>`…), y
casi todas responden "no existe" (-1). Cada prueba llama a `DVD::ConvertPathToEntrynum` (encontrada con la **tabla de
símbolos** del traductor: `func_8015DF4C`), que recorre el **FST** (el índice del disco) entrada por entrada,
comparando letra por letra sin distinguir mayúsculas. En wasm eso costaba **337–389 ms seguidos** por ráfaga: un
cuadro de 16,7 ms se volvía de un tercio de segundo.

**Primer intento descartado: recordar las respuestas.** Los ~9.300 nombres son casi todos distintos; recordar no
ayuda.

**Lo que se hizo: la misma búsqueda, nativa y con tabla hash** (`web/dvd/rutas_nativo.cpp`, código nuestro, no
parche):

1. La primera vez arma, por cada carpeta del índice, una **tabla hash**: nombre en minúsculas (con la tabla de
   minúsculas del propio juego) → entradas en el orden del FST.
2. Cada búsqueda camina la ruta igual que el SDK de Nintendo: "/" vuelve a la raíz, "." y ".." son especiales, una
   "/" al final pide una carpeta, en medio de la ruta solo valen carpetas, y gana la primera que coincide en el orden
   del FST.
3. Lo raro se le pasa a la función traducida del juego: nombres que empiezan con ".", el modo de nombres cortos 8.3,
   nombres de más de 512 letras o un índice ilegible.
4. Si cambia el índice (dónde empieza, la tabla de nombres o la cantidad de entradas), la tabla se vuelve a armar.

**Cómo entra al juego sin retraducir: copia del shard** (`compilar-web.py`, `REEMPLAZOS`). El truco anterior
(renombrar con `-D` al compilar) no servía: `DVD::Open` llama a la búsqueda desde el mismo archivo C++
(`MKW_STATIC_TRANSLATED_CALL`), y esa llamada se saltaba nuestro reemplazo. Ahora se copia el shard a
`build/web/node/gen/reemplazos/`, en la copia solo la *definición* pasa a llamarse `func_8015DF4C_traducida`, y nuestro
archivo define `func_8015DF4C`: todas las llamadas llegan a la nuestra. (El THP de §47 pasó a usar lo mismo.)

**Modos para comparar** (`?rutas=` en la página, `MKW_RUTAS` en Node): sin nada, la nativa; `traducido`, siempre la
del juego; `comparar`, las dos, avisando si alguna respuesta difiere; `listar`, anota cada nombre buscado.

**Resultado:**

| | Antes (traducida) | Ahora (nativa) |
|---|---|---|
| Ráfaga de la largada | 337–389 ms | **9–13 ms** para 18.000–25.000 búsquedas |
| Modo `comparar` | — | 13.463 búsquedas iguales en la primera corrida; **25.413 iguales** en el build final (§51) |

Pero el tirón no se fue entero: ~2 s después de la ráfaga quedaba un segundo a 5–10 fps donde el perfil decía
"inactivo" (el juego no trabajaba: esperaba algo). Eso es §51.

### 51. El tirón de la largada (2): pipelines en segundo plano y precalentados · 00:55–01:25

**La sospecha.** "Inactivo" en el perfil + imagen congelada = la página espera a otro. Los candidatos: la red (un
archivo nuevo) o la tarjeta de video armando **pipelines**. Para distinguir, se agregó a aurora un contador por
segundo (`[pipelines] …` en la consola).

**La medida que lo confirmó** (guion completo, perfil nuevo de Chrome = primera visita):

| Momento | Pipelines nuevos | Imagen |
|---|---|---|
| Entrar al menú | 80 en 2 s | **2 fps** durante 2 s |
| Elegir pista | 54 | 2 fps |
| Presentación | 59 | **0 fps** durante 2 s |
| Largada | 31 | 3,9 fps |

La llamada en sí (C++ → navegador) tardaba solo 3–8 ms por tanda. El costo real está en el **proceso de GPU del
navegador**: en Windows, Chrome traduce cada shader WGSL a HLSL y lo compila para Direct3D, ~25 ms cada uno, y
mientras tanto **todo lo de atrás espera** (también mostrar el cuadro). 80 pipelines × 25 ms = 2 s congelado. En la
web aurora los pedía con `CreateRenderPipeline`, que va en la fila de la única máquina de la línea.

**Arreglo 1 — pedirlos en segundo plano** (`pipeline_cache.cpp`, `gx.cpp`, `common.cpp`; parche `aurora-web.diff`):

1. Cuando el juego necesita un pipeline nuevo, `build_pipeline` usa `CreateRenderPipelineAsync`: Chrome lo compila en
   sus hilos de fondo y avisa cuando está (el aviso llega en `ProcessEvents`, al final de cada cuadro, en un punto
   fijo, no en medio de otra cosa).
2. Mientras no llegó, **el dibujo que lo necesita se salta**: ese objeto falta uno o dos cuadros, en vez de congelar
   todo. Es lo mismo que hace aurora en escritorio con "Skip draws while shaders compile" (prendido por defecto).
3. Excepción: las pasadas que hornean una textura que queda para siempre (`requireReady`, como el minimapa). Ahí no se
   puede saltar (la textura quedaría incompleta para toda la carrera), así que se arma en el momento, como antes.
4. `?pipelines=sincronico` vuelve a lo de antes, para comparar.

Con esto la largada pasó de 2 s a 2–4 fps a un segundo a 26 fps, pero quedaban 154 pipelines "armados en el momento"
(los del punto 3) y 2.336 dibujos saltados en la partida.

**Arreglo 2 — precalentar con una lista** (aurora + `web/navegador/pipelines.mjs`):

1. aurora lleva una lista de cada configuración de pipeline usada (en escritorio la guarda en su caché sqlite; en la
   web esa caché está apagada) y la exporta a la página con tres funciones (`mkw_web_pipelines_cuantos`, `_armar`,
   `_datos`). Formato: `MKWPIPE1`, cantidad, y por cada una tipo, versión, primer cuadro, tamaño y los bytes.
2. La página guarda la lista en **IndexedDB** cada 10 s si creció, y al esconder la pestaña.
3. Al abrir la página, antes de `main()`, deja dos archivos para aurora: la lista de este navegador y la **semilla**
   del servidor (`/build/pipelines.bin`, 414 pipelines, 1,1 MB). aurora los pone en la cola y los pide en segundo
   plano de a 8 por cuadro (~0,2 ms cada uno): **los 414 quedan pedidos 2,1 s después del arranque**, mientras se
   ve la advertencia y el título. Descarta los de otra versión (otra compilación de aurora).
4. La semilla se arma jugando: `node web/navegador/guion.mjs "<pasos>" --semilla`. Va con el `.wasm` a R2, nunca a git.

**Resultado** (guion de 18 pasos hasta 25 s de carrera, perfil nuevo de Chrome cada vez = primera visita):

| | Antes | En segundo plano | En segundo plano + semilla |
|---|---|---|---|
| Peor segundo de la largada | 2 s a 2–4 fps | 26 fps | **34 fps**, un solo segundo |
| Peor segundo en los menús | 0–2 fps durante 2 s | 16,6 fps | 25 fps |
| Pipelines armados en el momento | todos | 154 | **0** |
| Dibujos saltados en toda la partida | 0 | 2.336 | 491 |

**Lo que queda, explicado con números.** En la corrida con semilla, ningún segundo lento tiene pipelines nuevos. El
segundo de 34 fps de la largada es la **carga de la carrera**: el juego esperó 209 ms a la red (41 pedidos, 9,5 MB de
voces, minimapa y música que se bajan la primera vez). Después de ese segundo: 59–60 fps. En una segunda carrera
esos archivos ya están en la caché del disco (`disco.mjs`). Los menús tienen lo mismo (esperas a la red de 110–270 ms
al pasar de pantalla). Bajar esos archivos antes de que el juego los pida es otro trabajo (queda en el PLAN).

**Pruebas:**

- Node 13/0.
- Navegador **21/0**: 20 + 1 nuevo, "los pipelines se piden en segundo plano y su lista queda guardada"; dio 414 en la
  lista, leídos de vuelta 414, 0 armados en el momento, 60 fps, 100 % de cuadros parejos.
- Banco nuevo `pruebas/pipelines/` **14/0** (tres veces sin ventana y una en el panel). Usa un aurora falso y prueba
  la semilla, la lista propia, guardar solo si creció, guardar al esconder, datos malos e IndexedDB bloqueado.
- `?rutas=comparar` en el build final: 25.413 búsquedas, todas iguales.
- Foto de la carrera: minimapa y marcador completos.

**Trampa.** Al probar la página del banco en el panel, el reloj de 30 ms no alcanzaba a guardar en 90 ms: en una
pestaña de fondo el navegador espacia los relojes. La prueba ahora espera "hasta que pase" (máx. 3 s) en vez de un
tiempo fijo.

### 52. Bajar antes los archivos: el juego ya no espera a la red de a un pedido · 01:30–02:40

**El problema.** El juego lee el disco de a una lectura y espera cada una (con JSPI el juego queda en pausa
mientras llega). En esta PC cada pedido tarda ~1 ms y casi no se nota; en el sitio, hasta R2 por internet, tarda
~50 ms (la **latencia**). La carga de una carrera hace ~40 lecturas seguidas: 2 s esperando. Para medirlo sin
internet, el servidor local ahora puede simular esa latencia: `MKW_LATENCIA=50 node web/navegador/servidor.mjs`
(cada pedido a `/mkw/` tarda 50 ms más en empezar).

**Lo que se hizo** (todo en la página, `web/navegador/disco.mjs` y `mkw.mjs`, salvo el aviso, que sale del juego):

1. **Avisos de lectura.** `web/dvd/rutas_nativo.cpp` (la búsqueda nativa del índice, §50): cuando una búsqueda
   encuentra un archivo, llama a la página (`Module.mkwAvisoLectura`). Pasa la ruta de verdad, que da una función
   nueva del runtime (`mkw_dvd_ruta_de_entrada`, en `dvd.cpp`, parche `runtime-web.diff`). Medido con
   `?rutas=listar`: en la carga de la carrera, de 3.788 búsquedas 28 encuentran algo, y son justo lo que lee
   después (karts, íconos, voces). La página los baja enteros (hasta 4 MB; de los grandes, el primer MB), **todos a
   la vez**.
2. **Lectura adelantada.** Si el juego lee un archivo en orden (los videos THP de los menús, la música, Code.pul),
   se bajan 1, 2, 4… hasta 8 bloques (2 MB) por delante.
3. **Trampa: el bloqueo de la caché HTTP de Chrome.** Con latencia, el adelanto de un video seguía yendo de a un
   pedido (16 por segundo, cada uno esperando el anterior). En una simulación en Node andaba bien; en Chrome no.
   Causa: Chrome pone en fila los pedidos al mismo archivo que pasan por su caché HTTP. Arreglo: `cache: 'no-store'`
   en el pedido (la página ya guarda los bloques en su propia caché, así que no se pierde nada).
4. **Archivos diminutos.** Los 64 fantasmas del Contrarreloj (1–6 KB cada uno) se leen de a uno por cuadro: busca,
   lee, busca el siguiente. El aviso llega justo antes de cada lectura y no ayuda. Hay 613 archivos de ≤ 8 KB
   (1,5 MB en total): con el título en pantalla se piden todos en una **fila de prioridad baja**.
5. **Grupos de sonido.** El resto de la carga de la carrera eran pedazos de `revo_kart.brsar` (102 MB): el juego lee
   cada grupo de sonido de a pedazos. `web/navegador/brsar.mjs` lee la tabla de grupos del archivo (formato público
   de Tockdom, escrito desde la descripción; las 17 lecturas observadas caen todas dentro de grupos: 480 grupos, el
   más grande de 6 MB). Apenas el juego lee dentro de un grupo, se baja el resto del grupo de una vez. En un
   archivo con grupos no se usa la lectura adelantada (seguiría de largo y bajaría el grupo siguiente, que nadie
   pidió).
6. **Semilla de bloques.** Lo que queda es el "primer toque" de cada grupo: ~15 grupos por carrera, uno detrás de
   otro. 13 grupos (11,9 MB) aparecen en todas las carreras medidas; el resto depende de los personajes al azar.
   `guion.mjs --semilla` ahora también suma a `build/web/navegador/bloques.json` los bloques que el juego leyó **por
   primera vez después del título** (no los videos). Con 3 corridas, se usan los que aparecen en ≥ 2: 194 bloques,
   29,5 MB, la mayoría lo que leerá la primera carrera. La página los pide con prioridad baja (tope de 32 MB), en
   el orden en que el juego los fue necesitando.

**Que nada de esto le quite cuadros al juego.** El segundo plano va como mucho de a 12 pedidos. La fila baja:
- va de a 4, uno cada 40 ms, y nunca si el juego esperó a la red en los últimos 300 ms (se aparta de las cargas);
- guarda solo en Cache Storage, sin copiar el bloque ni meterlo en la memoria reciente (menos basura para el
  recolector de memoria).

**Trampa en la prueba del navegador.** Empezó a fallar "60 fps desde el cuadro 300" a veces, y también con todo
apagado (`?adelantar=0`, mínimo 37 fps). Causa: el título carga sus archivos justo entre los cuadros ~300 y ~360
(Code.pul de Retro Rewind, Title.szs, 2.416 búsquedas). Según dónde caía el corte del segundo, ese segundo entraba
o no en la medida. Con el adelanto ese segundo **mejora** (44–53 fps contra 38–39 sin él), pero sigue siendo una
carga. La prueba ahora mide "desde el cuadro 420 (el título ya cargado)": 21/0 tres veces seguidas.

**Resultado** (primera visita, perfil nuevo de Chrome, guion hasta 25 s de carrera):

| | Sin bajar antes | Con todo |
|---|---|---|
| Espera total al disco, red local (~1 ms) | 3,4 s | **1,5 s** |
| Espera total al disco, con 50 ms de latencia | 30,1 s | **5,0 s** |
| Segundos bajo 55 fps, con 50 ms de latencia | 55 | 22 (9 son de CPU, ver abajo) |
| Videos de los menús con latencia | 13–33 fps con esperas de 500–900 ms/s | sin esperas |

**Lo que queda, con números:**
- La carga de la carrera con 50 ms de latencia sigue teniendo ~2 s de pantalla quieta (mientras carga, en la
  transición). Es el primer toque de los grupos de sonido que dependen de los personajes al azar. Desde la segunda
  carrera, todo sale de la caché.
- En la presentación y la cuenta regresiva (los primeros ~15 s de carrera), el juego trabaja 17–20 ms por cuadro,
  sin esperar nada al disco: es CPU, por encima de los 16,7 ms del presupuesto. Es lo siguiente a atacar.

**Pruebas:**

| Prueba | Resultado |
|---|---|
| Banco `disco` (12 puntos nuevos con servidor lento: avisos en paralelo, sin pedir dos veces, tope de 12, prioridad baja, lectura seguida, salteadas, archivo grande, apagado, fallas) | 27/0 |
| Banco nuevo `brsar` (BRSAR falso: tabla, archivos rotos, grupo entero) | 9/0 |
| Node | 13/0 |
| Navegador | 21/0 tres veces |
| Parches | `git apply --check -R` limpio en los dos |

Parámetros nuevos de la página:
- `?adelantar=0` apaga todo;
- `?diminutos=0` y `?semillaBloques=0` apagan cada parte;
- `?trazaDisco=1` anota cada lectura del juego.

### 53. La presentación de la carrera: 37 MB copiados en cada cuadro · 02:45–04:10

**El problema.** Después de §52 quedaban segundos de 45–55 fps en la presentación de la carrera y la cuenta
regresiva, sin esperar al disco. El medidor de la página decía "trabajo 17–20 ms por cuadro" (presupuesto: 16,7).

**Medirlo bien primero.** El perfil de Chrome daba números confusos: 25 % del tiempo "ocioso" justo en los segundos
lentos, y el reloj (`_emscripten_get_now`, `clock_gettime`) como lo más caro. Dos herramientas nuevas para ver qué
pasa en **cada** cuadro, no en promedio:

1. **La traza del ritmo con contadores.** `guion.mjs --traza --extra "&traza=1"` vuelca la traza al final; la
   página ahora anota además, en la entrega (1) y en la vuelta de aurora (2), cuánto lleva esperado el runtime
   (retrace, pausas) y cuánto el disco.
2. **`herramientas/tiempos-cuadro.mjs`.** De a 60 cuadros: **juego** = CPU del juego entre una entrega y la siguiente
   (sin esperas ni disco), **aurora** = cerrar y codificar el cuadro, **ciclo** = cuánto duró de verdad. Trampa: MKW
   entrega el cuadro (GXCopyDisp) apenas pasa el retrace y **después** calcula el siguiente; medir "del retrace a la
   entrega" daba 2 ms y parecía que sobraba tiempo. El trabajo de un cuadro va de la vuelta de aurora (2) a la
   entrega siguiente (1).

Resultado: en los tramos pesados, **juego 14–17 ms + aurora 2–3 ms**, y 30–44 de cada 60 cuadros pasados de 16,7.
Era CPU de verdad. (Del perfil, la mayoría del reloj era espera activa: no cuesta cuadros.)

**La causa.** El perfil ahora nombra las funciones sin nombre de `mkw.js` con su columna. La más cara (7 %) era
una flecha dentro de `_emwgpuBufferGetMappedRange`, el pegamento de WebGPU de Emscripten. aurora llena cada cuadro
un **búfer de preparación** de 37 MB (24 MB uniformes, 8 almacenamiento, 3 vértices, 2 índices) y lo **mapea**.
En el navegador, mapear 37 MB significa: reservar 37 MB en la memoria del wasm, **llenarlos de ceros** y, al
desmapear, **copiar los 37 MB** al búfer de la GPU. Sesenta veces por segundo: ~4,4 GB/s de memoria movida para un
cuadro que usa ~1,5 MB. (Como cargar el capacitor entero de la fuente en cada ciclo aunque la carga consuma una
fracción.)

**El arreglo** (`aurora-main/lib/gfx/common.cpp`, parche `aurora-web.diff`, todo en `#ifdef __EMSCRIPTEN__`):
- el cuadro escribe en **un bloque normal** de la memoria del wasm (37 MB reservados una vez al arrancar, sin
  búferes de preparación en la GPU);
- al cerrar el cuadro, se sube **solo lo usado** con `Queue::WriteBuffer` (redondeado a 4 bytes). `WriteBuffer`
  entra en la cola de la GPU después de lo ya enviado y antes del dibujo de este cuadro, el mismo lugar donde iba
  la copia vieja, así que el resultado es idéntico;
- cada 10 s el log dice cuánto sube un cuadro: en carrera, vértices 200–440 KB, uniformes 220–530 KB, índices
  100–230 KB, almacenamiento 200–650 KB (**~1,5 MB, 25 veces menos**);
- `?staging=mapeo` vuelve al camino viejo para comparar.

**De paso: la espera activa de la presentación.** aurora espera hasta "su hora de presentar" (6,5 ms después del
retrace) con `emscripten_sleep` (cede: ahí el navegador toma el canvas) y después **giraba** hasta la hora exacta,
hasta ~2 ms por cuadro mirando el reloj. En el navegador `Present()` no hace nada y el canvas solo se toma mientras
el juego cede, así que ese giro no servía. Ahora solo cede (`aurora.cpp`, `wait_until_precise`). El giro de la
espera del retrace (`vi.cpp`, < 1 ms) se queda: ese sí pone el cuadro en hora.

**Resultado** (misma partida, intro + 14 s de carrera; `bash herramientas/medir-cpu.sh nuevo` contra
`bash herramientas/medir-cpu.sh viejo "&staging=mapeo"`):

| | Antes (`?staging=mapeo`) | Ahora |
|---|---|---|
| CPU del juego por cuadro (promedio) | 13,3 ms | **7,9 ms** |
| Cuadros con juego + aurora > 16,7 ms | 336 de 1140 | **9 de 1140** |
| Trabajo por cuadro en el título (prueba del navegador, máximo) | ~11 ms | **7,4 ms** |
| Hilo principal ocupado (prueba del navegador) | 29 % | **21 %** |
| Cuadros parejos en pantalla (traza de Chrome) | 96,7 % | 98,3 % |

Los segundos que siguen bajo 57 fps son cargas (la transición a la carrera espera ~4 ms de disco y ~170 ms en un
solo cuadro), no CPU.

**Pruebas:**

| Prueba | Resultado |
|---|---|
| Navegador | 21/0 (dos veces: con el bloque plano y sin el giro) |
| Partidas | 6/0 |
| Celular (Pixel 7 emulado) | 16/0 |
| Errores en el log | los mismos que con el camino viejo (sin errores de WebGPU) |
| Imagen | foto de la cuenta regresiva igual que antes (HUD, karts, pista) |
| Parche | `aurora-web.diff` regenerado, `git apply --check -R` limpio |

Herramientas nuevas: `guion.mjs --traza`, `herramientas/tiempos-cuadro.mjs`, `herramientas/medir-cpu.sh`, funciones
sin nombre del perfil con su línea y columna. Parámetro nuevo: `?staging=mapeo`.

### 54. Medir como en la página real, el tirón en carrera y la carga · 04:10–06:30

**El pedido.** Llevar el rendimiento al máximo **en las mismas condiciones que tendrá en paginita-pro.cl**, no en el
servidor cómodo de pruebas: medir primero con un script repetible, después optimizar de a un cambio, medido antes y
después, y dejar un parámetro que vuelva al camino viejo. Además, el dueño jugó y notó **tirones en carrera**, sobre
todo al tomar booster pads.

**1. El sitio en esta PC (`herramientas/sitio-local.mjs`).** Dos servidores, los dos solo en 127.0.0.1:

- **"GitHub Pages"** (puerto 8150): los archivos del repo del sitio (`terceros/Paginita-Pro`, rama
  `claude/loving-planck-9k2yam`) servidos como los da Pages: solo archivos, gzip, `Cache-Control: max-age=600`, ETag y
  **sin COOP/COEP**. La página no queda aislada (`crossOriginIsolated` = false, sin `SharedArrayBuffer`): el juego
  corre igual porque usa un solo hilo + JSPI, como BT3. Nuestra página va en `/juegos/mkw/`.
- **"El Worker"** (puerto 8151): lo privado (programa, manifiesto, disco y Retro Rewind) desde **otro origen**, con
  CORS solo para el origen del sitio y 50 ms de latencia en cada pedido (la red hasta R2). La página lo pide con
  `?privado=http://127.0.0.1:8151`.
- **Dentro de Juegos**: `http://127.0.0.1:8150/juegos.html?mkw=1` abre la página de Juegos de verdad (Firebase,
  mando.js, volumen.js e i18n.js corriendo) en la ruta de BT3 solo (`#solo/bt3`) y pone el marco del juego en
  `#pantalla` como `crearBt3Solo`: `<iframe class="jg-bt3-solo" allow="fullscreen; gamepad">` con `html.jg-bt3solo`.
  Eso lo agrega solo este servidor de pruebas.

**2. Medir (`herramientas/medir-sitio.mjs`).** Abre Chrome de verdad (el instalado, con la tarjeta NVIDIA, sin
sonido), entra a Juegos, maneja los menús con teclas contando **cuadros del juego** (no milisegundos: así llega igual
aunque la CPU esté frenada) y, ya en la carrera, mantiene acelerar 20 s (`--items`: usa un ítem cada 2 s; un hongo da
el mismo empujón que un booster pad). Reporta:
- tiempo hasta el primer cuadro y hasta la carrera; fps de la carrera;
- **CPU por cuadro** (juego + aurora, de la traza del ritmo): promedio, p95, p99, máximo y cuántos pasan de 16,7 ms;
- **ritmo en pantalla**: lo que de verdad llega al monitor (Chrome anota cada imagen, `Display::FrameDisplayed`):
  cuántas duran 4 refrescos (a 240 Hz) y "a compás" (ver abajo);
- GPU por cuadro (con `?gpu=1`), hilo principal ocupado (%), memoria del wasm, MB bajados por origen y desde la
  caché HTTP, carga del programa (bajada, compilación);
- desglose de cada tirón (juego / aurora / espera del runtime / disco).

Perfiles: `pc`, `cpu4` (CPU 4 veces más lenta) y `celular` (Pixel 7 emulado + CPU 6 veces más lenta). Opciones:
`--visitas 2` (la 2.ª con caché), `--red 50` (50 Mbit/s), `--perfilar`, `--trazaChrome`, `--extra "&param=…"`.
Todo queda en `build/web/datos/medir-sitio/`.

Trampa de la medida: la pantalla también muestra **imágenes de más** que no son cuadros del juego (cuando cambia un
texto de la página, p. ej. el medidor de fps cada segundo, el compositor dibuja una imagen extra: 2+2 refrescos en vez
de 4). La imagen del juego no cambia ni se corre; el ojo no lo ve. La cifra "a compás" junta esos huecos.

**3. El tirón en carrera: la toma del canvas.** La traza mostró que el juego entrega sus cuadros parejos (98 %
cada 4 refrescos), pero el navegador los **tomaba** disparejos: 80 % con 4 refrescos, el resto 3 y 5. Tres causas,
tres arreglos (en `aurora.cpp` y `mkw.mjs`):

| Causa | Arreglo | Volver al camino viejo |
|---|---|---|
| La pausa de presentar de aurora no cedía si faltaban menos de 2 ms: el navegador tomaba el canvas tarde | siempre cede, y vuelve apenas el navegador hizo su actualización de la pantalla (`mkwEsperaToma`) | `?esperaToma=0` |
| Una actualización de la pantalla **atrasada** (pasó un refresco mientras el juego tenía el hilo) se llevaba el cuadro nuevo un refresco antes | antes de tomar la textura del canvas, aurora deja correr esa actualización (`mkwTomaAtrasada`/`mkwEsperaAtrasada`) | `?atrasada=0` |
| El momento de entrega varía ±1,5 ms alrededor de un refresco: a veces cae antes, a veces después | **compás**: el cuadro se toma en el refresco "toma anterior + 4"; si el juego entrega antes, espera; si entrega tarde, se toma apenas se pueda y el compás se rearma | `?compas=0` |

Resultado en las **tomas** (traza del ritmo, 1900 cuadros): de 83 % a **98,6 %** cada 4 refrescos. En **pantalla**
la mejora es menor y la medida varía entre corridas: con el compás, 95,0 % y 95,1 % a compás (dos corridas); con el
camino viejo, 97,6 % y 90,8 %. El compás quedó porque es estable. La CPU por cuadro bajó de 9,4 a 7,5–8,5 ms (aurora
ya no duerme pasado el momento de la toma). Lo que queda disparejo en pantalla (~5 %) ocurre después de la toma, en
el compositor de Chrome.

Probado y descartado: dejar 2,5 ms de margen entre la entrega y el refresco de la toma (69–74 % a compás contra
95 %). Se sacó del código.

**4. El tirón de la largada: las voces de los corredores CPU.** Con `?trazaDisco=1` la página ahora anota cada
lectura que espera y **dónde estaba** su bloque (memoria, en camino, en la cola de prioridad baja, en Cache Storage).
Al empezar la cuenta regresiva el juego lee la voz de cada corredor de la consola, de a una: el comienzo de su grupo
en `revo_kart.brsar` (`GRP_VO_MR_NPC`…) y, para los personajes de Retro Rewind, su archivo en `Character/Sound`.
Son ~15 lecturas × ~60 ms de red = **~1 s de juego congelado**. La semilla de bloques no las tiene porque cambian en
cada carrera (los CPU son al azar).

- `brsar.mjs` ahora lee también los **nombres** de los grupos (la sección SYMB del formato público BRSAR, Tockdom), y
  la página pide con prioridad baja, intercalados en la semilla donde el juego los necesita, los 42 grupos de voces
  de CPU enteros (14 MB) y los 174 archivos de voces de CPU de Retro Rewind (26,7 MB). Solo en la 1.ª visita; después
  salen de la caché. `?voces=0` lo apaga.
- Arreglo en `disco.mjs`: cada bloque de un pedido ahora se entrega **apenas está**. Antes un bloque que ya estaba en
  Cache Storage esperaba a que otro bloque del mismo pedido llegara de la red (60 ms).
- La cola de prioridad baja espera 15 ms entre pedidos (eran 40) y junta bloques seguidos en un pedido: termina a
  los 23 s de juego en vez de 57 (la carrera empieza a los ~69 s).

Resultado: la espera de disco en la largada bajó de ~1000 ms a **~60 ms** (una sola lectura: la voz del personaje
del jugador). En la 2.ª visita no hay tirones.

**5. La carga del programa.**
- **Comprimido**: `mkw.wasm` (124,3 MB) se guarda también como `mkw.wasm.br` (brotli 11, **16,1 MB**) y
  `mkw.wasm.gz` (gzip 9, 28,6 MB) con `node herramientas/comprimir-build.mjs` (2,5 min). El Worker entrega el
  comprimido con `Content-Encoding: br`, y el navegador lo descomprime mientras compila. Así **ningún archivo
  guardado pasa de 100 MB**.
- **Con huella y guardable**: el manifiesto trae la cabecera `X-Mkw-Build` (huella de `mkw.js` + `mkw.wasm`). La
  página pide `mkw.js?v=huella` y `mkw.wasm?v=huella`, y el Worker los da con
  `Cache-Control: public, max-age=31536000, immutable`, como BT3. La 2.ª visita no los baja (caché HTTP) ni los
  compila (caché de código de Chrome). Las piezas del disco siguen con `no-store` (van a Cache Storage).
  `?huella=0` vuelve a pedirlos sin huella.
- **Compilar**: Emscripten usa `instantiateStreaming` sobre la respuesta del servidor (nunca un blob). El programa
  queda listo **0,1 s** después de llegar el último byte (en el perfil cpu4, 0,45 s).
- **Final**: `python herramientas/compilar-web.py --modo navegador --final` enlaza sin `--profiling-funcs` (los nombres
  de las funciones: 2,7 MB que solo sirven para perfilar) y comprime al terminar.

Primera y segunda visita (`--visitas 2 --red 50`, 50 Mbit/s, latencia 50 ms):

| | 1.ª visita | 2.ª visita |
|---|---|---|
| Programa por la red | 16,1 MB en 3,2 s (antes: 124,3 MB, ~20 s a 50 Mbit/s) | 0 (caché HTTP) |
| Primer cuadro | 7,9 s | **2,3 s** |
| Hasta la carrera (con los menús a teclazos) | 80,9 s | 66,6 s |
| Bajado del Worker | 210 MB | 4,6 MB |
| Tirones en la carrera | 3 (largada) | **0** |

**6. Base en los 3 perfiles** (`node herramientas/medir-sitio.mjs --perfil P --etiqueta base54 --items`, 1.ª
visita, dentro de Juegos, latencia 50 ms):

| | **PC** (×1) | **cpu4** (CPU ×4) | **celular** (Pixel 7, CPU ×6) | PC al empezar §54 |
|---|---|---|---|---|
| fps en la carrera | **60,0** | 17,7 | 4,0 | 60 |
| CPU por cuadro: promedio / p95 / p99 | **7,97 / 10,7 / 12,0 ms** | 56,3 / 82,9 / 104,7 ms | 248 / 328 / 364 ms | 8,94 / 10,2 / 11,2 ms |
| Cuadros > 16,7 ms | 1 de 1983 | todos | todos | 0 |
| Tirones en pantalla (imagen > 1,5 cuadros) | **0** | — | — | 4–7 (largada) |
| Hilo principal ocupado | 44 % | 99 % | 100 % | 41 % |
| GPU por cuadro (envío → terminado) | 5,1 ms | (lo frena la CPU) | (lo frena la CPU) | 3,0 ms |
| Memoria del wasm | 512 MB | 512 MB | 512 MB | 512 MB |
| Primer cuadro | 2,9 s | 5,4 s | 7,7 s | ~3 s |
| Programa listo después del último byte | 0,10 s | 0,45 s | 0,70 s | — |
| Bajado del Worker | 206 MB (programa 16) | 224 MB | 225 MB | 284 MB (programa 124) |

Cómo leerla:
- **En el PC el juego va sobrado**: 8 ms de 16,7, y la carrera ya no tiene tirones grandes.
- **Con la CPU frenada no escala parejo.** Frenada 4 veces, el juego gasta 7 veces más por cuadro; frenada 6
  veces, 30 veces más. El perfil de la carrera frenada es el mismo de siempre (juego traducido, sonido, aurora), sin
  nada raro. El freno de Chrome suspende el hilo a pedazos, y un programa que recorre mucha memoria (124 MB de
  código, 512 MB de memoria) pierde sus cachés en cada pausa. Es una cota pesimista, no la medida de un teléfono: el
  número real de un celular hay que medirlo en uno. Lo que sí dice: en equipos débiles el límite es la CPU del juego
  traducido, no la carga ni la GPU. Esa es la palanca que sigue.

Probado y descartado: pasar el programa por `wasm-opt -O3` (el optimizador de WebAssembly, además del `-O2` que ya
usa Emscripten al enlazar). Tarda 1 minuto y achica solo 2,4 % (130,4 → 127,2 MB); la CPU por cuadro en la carrera
quedó igual (8,17 contra 8,22 ms, dentro del ruido). No se usa.

**Pruebas:**

| Prueba | Resultado |
|---|---|
| Navegador (`prueba-navegador.mjs 900`) | **21/0** (cuadros parejos en pantalla 95,6 %) |
| Partidas (`prueba-partidas.mjs`) | **6/0** |
| Celular (`prueba-tactil.mjs`, Pixel 7 emulado) | **16/0** |
| Dentro de Juegos, como la página | `crossOriginIsolated` false, sin `SharedArrayBuffer`, juego a 60 fps |
| Imagen | foto de la carrera igual que antes (HUD, karts, mapa, posición) |
| Parche | `aurora-web.diff` regenerado, `git apply --check -R` limpio |

Herramientas nuevas: `herramientas/sitio-local.mjs`, `herramientas/medir-sitio.mjs`, `herramientas/comprimir-build.mjs`,
`herramientas/analizar-chrome.mjs` (qué tan ocupado está cada hilo en una traza de Chrome), `herramientas/subir-kit.sh`
(copia solo lo propio a `juegos/mkw/` del sitio) y `compilar-web.py --final`. Parámetros nuevos de la página:
`?privado=ORIGEN`, `?esperaToma=0`, `?atrasada=0`, `?compas=0`, `?huella=0`, `?voces=0`, `?gpu=1`. Del servidor:
`MKW_CORS=ORIGEN`, cabeceras `X-Mkw-Build` y `Timing-Allow-Origin`, `mkw.wasm.br` con `Content-Encoding: br`.

**Para el Worker de verdad** (lo publica el dueño): entregar `mkw.js`/`mkw.wasm` con `?v=` como guardables para
siempre (`immutable`) y el `.wasm` desde el objeto `mkw.wasm.br` de R2 con `Content-Encoding: br`; el manifiesto con
`X-Mkw-Build` (la huella que sube el script junto con los archivos) y `Access-Control-Expose-Headers` que la incluya.

### 55. La página con la cara del sitio, tu partida, Mi Mii y el piloto que te lleva a la carrera · 2026-10-17

**Qué pidió el dueño:** (1) que la página se vea como Paginita Pro; (2) que una persona común pueda cargar su licencia
y guardarla; (3) un "envoltorio" como el de Budokai: modos claros, elegir una pista o una copa completa, en línea por
nuestra página; (4) un modo solo para el Mii propio; y en el camino: entrar a una sala con la carrera andando (elegir
"siguiente carrera" o "sala", mirando mientras tanto), vistas previas de las pistas, el Canal Mii, y récords de tiempo
por pista y cilindrada en Firebase.

#### 55.1 La página nueva (`index.html` + `interfaz.mjs`)

Antes era una página de banco (cajas una debajo de otra). Ahora tiene la forma de la de BT3 con los colores del sitio
(IBM Plex Sans, Lilita One para títulos, el morado de Juegos) y un cielo de circuito de noche con bandera a cuadros
dibujado con CSS (nada del juego):

- **El juego ocupa toda la ventana.** El canvas mide la ventana y la imagen va centrada sin deformarse
  (`object-fit: contain`).
- **Tarjeta de inicio**: título, "Tu partida" (las licencias guardadas) y el botón grande **Jugar**.
- **Columna de modos**: Jugar libre, Gran Premio, Carrera, Contrarreloj, Batalla, En línea, Mi Mii. Cada uno con un
  emblema dibujado por nosotros (SVG). Los que todavía no llevan directo dicen PRONTO.
- **Barra de arriba**: volumen, Partida, Controles, ⚙, ⛶ y el mando conectado. Con el juego andando se esconde sola y
  vuelve al mover el mouse (como un reproductor de video). Dentro del sitio aparece «← Juegos».
- **Cajón a la derecha** con pestañas: Partida, Controles (táctil, mandos, teclas), Avanzado (sonido, tarjeta de video,
  datos del juego, diagnóstico y registro).
- **Diálogos propios** en vez de `confirm()`/`alert()`, que dentro del marco del sitio (con sandbox) no funcionan.

Se conservaron todos los `id` que usan `mkw.mjs` y las pruebas. Cambios en las pruebas: `prueba-navegador` hace el clic
de desbloquear el sonido en una esquina del juego (el título ya no está a la vista); `prueba-tactil` abre la pestaña
Controles para ver los ajustes del mando táctil.

#### 55.2 Tu partida: cargarla, guardarla, deshacer

**Cómo lo vive una persona:** en la tarjeta de inicio ve sus licencias ("Ana · VR 5.230 · 812 carreras", con su código
de amigo). Si ya juega en una Wii o en Dolphin: **Cargar mi partida…** (o arrastrar el archivo a la página). La página
mira qué es por dentro (no por el nombre), lo revisa, muestra qué licencias trae y pregunta antes de reemplazar. Para
llevarla de vuelta: **Descargar rksys.dat** (va en la misma carpeta de la Wii o de Dolphin) o **copia completa** (.mkwp,
para otro navegador). «¿Dónde está mi partida?» explica las carpetas (SD de la Wii con RR, Dolphin con RR o WheelWizard,
Dolphin sin mods con los códigos de región).

- `licencias.mjs`: lee rksys.dat (formato público de mkwiiki/Tockdom): "RKSD", licencias "RKPD" cada 0x8CC0 bytes,
  nombre UTF-16, VR, BR, carreras, ID de perfil → código de amigo, y **CRC-32 al final**. Un archivo con el CRC malo
  NO se carga: el juego diría que está dañado y ofrecería borrarlo.
- `guardado.mjs`: `abrirPaquete` (revisa un .mkwp sin tocar nada, para mostrar qué trae), `leerArchivo` y
  `ponerArchivo` (reemplaza SOLO el rksys.dat: los ajustes de RR y los fantasmas quedan).
- `respaldos.mjs`: antes de cargar, borrar, restaurar o guardar Mii, una copia de todo (el mismo .mkwp, ~3 KB) en otra
  base del navegador, con fecha, motivo y qué licencias tenía. Quedan las últimas 8, con «Restaurar».

#### 55.3 Mi Mii

Mario Kart Wii no tiene editor de Mii: los toma de la memoria interna de la Wii (`RFL_DB.dat`), donde los pone el Canal
Mii, un programa aparte de la consola que no está en el disco. La página arma esa base ella misma:

- `mii.mjs`: un Mii son 74 bytes de campos de bits (wiibrew, "Mii data"). El formato se escribe UNA vez (`GRUPOS`) y
  sirve para leer y para escribir. Se conservan también los bits sin uso conocido. La base (`RFL_DB.dat`, 0x1F1E0
  bytes): "RNOD", 100 casillas de 74 bytes y **CRC-16/XMODEM** al final (confirmado: 3dbrew dice que la Wii usa ese).
- `editor-mii.mjs`: lista de Mii, **caras de partida** (12 armadas por nosotros + 🎲 al azar, como los Mii invitados
  del juego: se elige una y se le pone nombre y color), pestañas de rasgos con deslizadores y una vista previa
  aproximada dibujada por nosotros. También carga y descarga un `.mii` o la base entera. El Mii de una licencia se marca
  con ⭐ (se reconoce por su id, que se conserva al editarlo).

**Comprobado en el juego:** `guion.mjs --mii` deja una base con 2 Mii inventados y recarga. Al crear la licencia,
«Choose a Mii!» muestra los dos (uno con lentes, otra con pelo largo), y se puede crear la licencia con «Prueba».

#### 55.4 Elegir pista o copa: el piloto

La página no puede llamar al juego, pero puede hacer lo mismo que una persona: apretar botones. Para no apretar a
ciegas (con esperas fijas que fallan si una pantalla tarda), **mira la memoria del juego**:

1. `puente.cpp`: `mkw_web_mem(dirección)` da dónde quedó, dentro del wasm, la memoria de la Wii (dos bloques fijos:
   MEM1 en 0x80000000 y MEM2 en 0x90000000). Trampa: hay que pedirlo cuando el juego ya arrancó (antes vale 0).
2. `menus.mjs`: lee la **sección y la página** del menú (SectionMgr, puntero en 0x809C1E38) y lo elegido (Racedata,
   puntero en 0x809BD728). Las direcciones salen del código abierto de Pulsar (`symbols.txt`).
   Recorrido medido con `guion.mjs` (ahora anota la pantalla de cada paso):

   | Sección | Páginas |
   |---|---|
   | 0x3f | título |
   | 0x45 | crear licencia |
   | 0x41 | menú principal (0x5a) |
   | 0x48 | un jugador |
   | 0x19 / 0x1a | carrera (GP / VS) |

   Dentro de "un jugador" (0x48), en orden: 0x69 modos → 0x6a o 0x72 cilindrada → 0x6b personaje → 0x6c kart →
   0x10e (una de RR) → 0x6d derrape → 0x6e copas → 0x6f pistas → 0x101 variante de RR → 0x4b «OK».
3. **CupsConfig de Pulsar.** Escribir la copa en Racedata no sirvió: Retro Rewind guarda la copa en su propio objeto.
   Se encontró buscando en la memoria la estructura que cambiaba al elegir dos copas distintas. Quedó en **0x8043319C**:

   | Desplazamiento | Qué guarda |
   |---|---|
   | +0x00 | copa (0x40 + n) |
   | +0x10 | pista ganadora |
   | +0x14 | pista elegida |
   | +0x24 | cantidad de copas (90) |

   Las pistas de RR se numeran 0x100 + 4·copa + fila. Si se escriben antes de abrir la pantalla de copas, el cursor
   aparece en la copa y la fila pedidas. No hay puntero que lleve a ese objeto (está dentro del código de RR), así que
   antes de escribir se revisa que tenga la forma esperada.
4. **El piloto** (`crearPiloto`): una máquina de estados. Según la página, aprieta A, o abajo para elegir el modo, o
   deja escrita la copa. Comprueba en **lazo cerrado**: el modo en la pantalla de cilindrada y la pista en la
   confirmación; si no es lo pedido, B y corrige. Aprieta por una fuente nueva del puerto 1 de `controles.mjs`
   (`pilotar`), que se manda enseguida (con la pestaña en segundo plano requestAnimationFrame no corre: esa fue la
   trampa). Se detiene si la persona toca una tecla o el mando.
5. **Los nombres**: la tabla de textos de RR (BMG en memoria) tiene en el mensaje 0x20000 + n el nombre de la pista n.
   La lista para elegir (con buscador) los muestra tal como los trae el juego en esa PC. Quedan anotados en el navegador
   para la próxima vez. No se suben a ningún lado.

**Resultado:** «Carrera, copa 14, pista 3» llega sola a «GBA Bowser Castle 4» en ~25 s desde que se abre la página.
«Gran Premio, copa 4» empieza en «SNES Vanilla Lake 1, 1st Race». En el panel del navegador: Carrera → Jugar → la lista
→ buscar «rainbow» → «N64 Rainbow Road» → la carrera. Falta elegir cilindrada (hoy la que viene marcada: 150cc en VS,
200cc en GP) y personaje.

#### 55.5 En línea (diseño) y lo que viene

El diseño completo está en `docs/en-linea.md`: "WFC virtual" dentro de la sala. Los sockets de la Wii van a JavaScript,
el UDP del juego por WebRTC, un servidor WFC chiquito en la pestaña del anfitrión, y Firebase solo para presentar a los
jugadores, como BT3. Lo de entrar con la carrera andando ya lo hace el juego (vista en vivo): «Entrar en la siguiente
carrera» arranca y espera mirando; «Ir a la sala» muestra el video del anfitrión. Son semanas de trabajo, en fases F0–F4
con prueba en el banco cada una.

Pendiente de esta tanda:

- Vistas previas de cada pista: fotos sacadas del juego, una por pista, que van a R2 con el `.wasm` (son imágenes del
  juego: nunca a git).
- Récords de tiempo por pista y cilindrada en Firebase: leer el tiempo final de la memoria del juego.
- Integrar el Canal Mii: haría falta el del propio dueño (un respaldo de su Wii) y traducirlo aparte.

**Pruebas (con la compilación `--final`):**

| Prueba | Resultado |
|---|---|
| Banco sin el juego (`banco/correr.mjs`): licencias, mii, guardado, controles, nube | **19/0, 11/0, 15/0, 28/0, 23/0** |
| Piloto con el juego (`prueba-piloto.mjs`) | **9/0** (Carrera copa 14 pista 3 y Gran Premio copa 4) |
| Navegador (`prueba-navegador.mjs 900`) | **20/0** (60 fps, trabajo máx. 6,5 ms) |
| Partidas (`prueba-partidas.mjs`) | **6/0** |
| Celular (`prueba-tactil.mjs`) | **16/0**, después de dos arreglos: la tarjeta de inicio tapaba el mando táctil (la prueba ahora simula «juego andando») y la barra tapaba el ▶ (en el celular la barra va arriba al centro) |
| Mii en el juego (`guion.mjs --mii`) | los 2 Mii de la página aparecen en «Choose a Mii!» |
| Carrera sola, sin CPU, manejando la CPU (`&cpu=ninguna&autoconducir=1`) | terminó sola; la página leyó el tiempo final de la memoria (2:22.846, 1.º) y la página de resultados es la 0x2f |

**Comandos:**

```bash
python herramientas/compilar-web.py --modo navegador --final
node banco/correr.mjs licencias mii guardado controles nube
node web/navegador/prueba-piloto.mjs
node web/navegador/guion.mjs "K:2500 K:2000 K:2500" --mii
node web/navegador/guion.mjs "-:30000" --extra "&modo=vs&copa=13&fila=2"
```

`banco/correr.mjs` es nuevo: corre páginas del banco en Chrome sin ventana y junta sus ✓/✗. `guion.mjs` tiene tres
cosas nuevas: anota la pantalla de cada paso, `X:ms` evalúa `--evaluar` en ese momento, y `--mii`.

### 56. «Copa a tu gusto» con su semilla · 2026-10-17

**Qué:** en «Copa a tu gusto» la persona elige 4 pistas y una **semilla** (un número que se ve y cambia con 🎲). Con la
misma semilla, la misma copa se juega igual (los mismos objetos de las cajas, lo mismo de los CPU).

**El problema:** la página escribía la semilla en Racedata, pero al preparar cada carrera el juego la pisaba con el
reloj de la consola (`RacedataScenario::InitRng`, 0x8052F924, instrucción `mftb`). Como poner un valor en un registro
que un temporizador sobrescribe en el siguiente pulso.

**Arreglo:** `web/juego/semillas_nativo.cpp` reemplaza esa función (mismo mecanismo que el THP nativo: `REEMPLAZOS` en
`compilar-web.py`; la traducida pasa a llamarse `func_8052F924_traducida`). Primero corre la del juego; después, si la
página pidió una semilla para esta carrera (`Module.mkwSemillas()` → `[s1, s2]`), escribe esas dos en la copia de la
carrera (+0xB74, +0xB78). En los demás modos queda exactamente lo del juego.

También: `copasRR` cuenta solo las copas de **carrera** (CupsConfig dice 90 copas en total, de ellas 44 arenas de
batalla = 11 copas; quedan 79), y `pistas.json` de las fotos quedó en 79 copas (antes las 80–89 daban vuelta a la copa 0).

### 57. Récords por pista y cilindrada (local + Firebase) · 2026-10-17

`web/navegador/records.mjs`: mientras hay una carrera, mira la memoria cada ½ s; cuando el jugador 1 cruza la meta lee
su tiempo final (Raceinfo → jugador → Timer), la pista (CupsConfig de Pulsar), la cilindrada y el modo (Racedata) y
arma la categoría (p. ej. `tt150`, `vs200`). El mejor de cada pista y categoría queda en el navegador y, con sesión del
sitio, en Firestore (`mkw_records/{pista}-{cat}/tiempos/{uid}`, solo si mejora; las reglas lo exigen:
`docs/firebase-mkw.md`). La tabla = los 10 mejores. Probado con un Firestore falso que imita las reglas
(`banco/pruebas/records`).

### 58. En línea: un WFC dentro de la pestaña y dos consolas corriendo juntas · 2026-10-17

**Qué pidió el dueño:** "haz pruebas y asegúrate que el modo en línea funcione, es clave". Y en el camino: el
multijugador va **solo por nuestra página** (salas como BT3), cada jugador guarda su **VR** en Firebase, y las salas en
línea tienen que poder **rellenarse con CPU**.

**La idea en una línea:** el juego cree que se conecta a los servidores de Retro WFC; en realidad cada "socket" que abre
llega a la página, y la página lo lleva a un **WFC escrito por nosotros** que corre dentro de la pestaña anfitriona.
Entre pestañas los paquetes viajan por BroadcastChannel (después, entre computadores, por WebRTC). Ningún paquete sale a
internet. Como un banco de pruebas de comunicaciones con un switch y un servidor simulados en la misma mesa.

#### 58.1 Los sockets del juego, hacia la página

El juego (DWC, la biblioteca de red de Nintendo, y el runtime de WiiCompiled) usa las funciones POSIX de red: `socket`,
`connect`, `sendto`, `recvfrom`, `poll`, `getaddrinfo`… En `web/red/red_web.cpp` definimos **todas esas funciones con
el mismo nombre**: al enlazar, las de un archivo objeto propio ganan a las de la librería del sistema (como soldar un
puente que deja fuera de circuito a la pieza de fábrica). Cada una llama a `Module.mkwRed` (la pila de la página).

- Las que **esperan** (un `recv` bloqueante, un `poll` con tiempo) duermen sin trabar el navegador gracias a **JSPI**
  (`mkw_red_esperar`, con tope de 15 s): el juego "se queda esperando" mientras el navegador sigue andando.
- `close` y `fcntl` no se pueden reemplazar así (los usa todo); el runtime llama a `mkw_red_cerrar` y
  `mkw_red_bloqueante` (parche en `network_core.cpp`).
- SSL: el juego pide conexiones cifradas (HTTPS); dentro de la red de juguete van sin cifrar (parche en
  `network_ssl.cpp`). Nada sale a internet, así que no hay nada que proteger en el camino.
- Nuestros sockets empiezan en el número 0x7000 para no chocar con los de archivos.

#### 58.2 La pila de red de la página (`red.mjs`)

`crearPila({ ip, enlace, dns })`: sockets UDP y TCP con sus colas, conexiones TCP con apretón de manos
(syn → ack, d = datos, fin, rst), puertos efímeros, y el DNS que contesta siempre `10.77.0.1`. `crearConmutador` (en
memoria, para una pestaña) y `crearEnlaceCanal` (BroadcastChannel entre pestañas) llevan los paquetes. Se puede mirar
el tráfico por cada vecino (`cuentas()`: enviados, recibidos, tirados) y, para depurar, anotar cada paquete
(`globalThis.mkwTrazaUdp = []`).

Trampa encontrada: las conexiones que el WFC aceptaba no se liberaban al cerrarse: a las 64 se llenaba la tabla y fallaba
("reading 'recibido'"). Ahora se liberan con fin/rst y el tope es 256; 300 conexiones seguidas dejan 1 socket abierto.

#### 58.3 El WFC (`wfc.mjs`, `wfc-salas.mjs`)

Escrito desde la descripción pública de cada protocolo (sin copiar código de wfc-server, que es AGPL):

| Servicio | Puerto | Qué hace el nuestro |
|---|---|---|
| available | UDP 27900 | "sí, el juego tiene servicio" |
| NAS | HTTP 80 `/ac` | crea la cuenta, login (token + reto), ubicación del servicio |
| GPCM | TCP 29900 | login comprobando la respuesta MD5 (la misma cuenta que hace el juego, verificada), perfil, amigos vacíos, estado, `ka` |
| QR2 | UDP 27900 | latidos, reto → registrada, keepalive, mensajes de cliente |
| Lista de salas | TCP 28910 | filtro tipo SQL, respuesta cifrada con enctypeX (clave `9r3Rmy`); pasa mensajes entre consolas por QR2 |
| NATNEG | UDP 27901 | junta a las dos consolas por su cookie y les manda CONNECT con la dirección de la otra |
| SAKE | SOAP | FriendInfo por perfil |
| API de RR | HTTP | `mkw_stats`, `multiplier`, `mkw_rr_ratings` |

Como Retro WFC, la búsqueda **no separa por VR** (`ev`, `eb` se ignoran en el filtro): con poca gente, que todos se
encuentren.

#### 58.4 Dos pestañas a la par: sin "enganche" al monitor

Con dos juegos en dos pestañas, uno iba a 59,43 cuadros/s y el otro a 59,87: el que se atrasa acumula diferencia y Retro
Rewind avisa "Detected frame lag". La causa: el modo "enganche" (esperar el refresco del monitor) pierde un cuadro cada
vez que una pestaña se pasa del refresco. Con `?red` el enganche queda apagado: las dos van a ~59,8 con ±2 cuadros, sin
acumular.

#### 58.5 Primera carrera en línea… y una desconexión a los 34 s

Resultado: las dos pestañas se encuentran (lista de salas + NATNEG), pasan por la sala (sección 0x58) y corren
(0x68) viéndose en la pista, ~36 paquetes UDP por segundo en cada sentido y 0 perdidos. Pero a los ~34 s de largar,
**las dos** mostraban "You were disconnected from the other players", al mismo tiempo.

Cómo se buscó (cada paso descartó una sospecha):

1. **¿Se cortó el tráfico?** Traza de cada paquete (`mkwTrazaUdp`): llegan paquetes hasta el último milisegundo. No es
   la red. El contador de cuadros que va en el paquete de carrera (RACEHEADER_1) marcaba 1801 al cortar: **30,0 s de
   carrera exactos**. Un temporizador del juego.
2. **¿Un error de DWC?** Ganchos de depuración (`web/juego/depurar_red.cpp`, solo con `MKW_DEPURAR=1` al compilar) en
   `DWCi_SetError` y `DWC_CloseAllConnectionsHard`, que anotan la **cadena de llamadas** recorriendo la pila de la Wii.
   Para eso se armó la tabla dirección → nombre a partir de `guest_symbol_table.cpp` (20 193 funciones con nombre).
   Ningún error de DWC antes del corte.
3. **¿El temporizador de "no recibí nada"?** `DWCi_TransportProcess` corta a un jugador si pasan **7 s** sin datos de
   él. El reloj de cada jugador se actualizaba bien (se leyó en vivo). No era.
4. **Un "osciloscopio" de memoria:** desde la página, cada 4 ms, leer las banderas de `RKNet::Controller` y anotar solo
   los cambios. Las dos pestañas levantaban la bandera de apagado **en el mismo cuadro** (±4 ms): lo dispara la lógica de
   la carrera (que va sincronizada cuadro a cuadro), no la red.
5. **Quién pide salir:** ganchos en `SectionMgr::SetNextSection` → la orden de ir a la escena 0x79 ("desconectado")
   venía de `Pages::DisconnectMgr::OnUpdate`. Leyendo su código traducido: corta si un byte del modo de juego
   (RaceInfo+0x10 → +276) vale 1. El osciloscopio lo confirmó: ese byte pasa a 1 justo en el corte.
6. **Quién escribe ese byte:** `GMDataOnlineVS`, con la versión de Retro Rewind. Es el **anti-AFK**: para cada jugador
   local, si su kart va más lento que un umbral, cuenta cuadros; pasado el límite marca "inactivo" y la consola se
   desconecta de la sala.

**Conclusión: no era un error nuestro.** El robot de la prueba solo apretaba A y el kart quedaba contra una pared. El
juego hace exactamente lo que haría en una Wii: saca al que no maneja.

**Para las pruebas:** el piloto automático en línea pone al jugador local como CPU **en la sala, antes de cargar la
carrera** (en la carrera ya es tarde: el juego arma los pilotos al cargar). Funciona para el **anfitrión de la sala**
(puesto 0): su kart corre solo, la otra pestaña lo ve, y la carrera llega a 2:07 con los dos relojes iguales (±0,25 s)
y cada uno viendo al otro en el minimapa. En el puesto 1 (el que se une) el kart queda quieto: el juego en línea no
anima CPU de otra consola. Por eso los "CPU de relleno" en línea necesitan un cambio en el juego (pendiente, ver 58.8).

Trampa: algunas funciones chicas (como `RKNet::Controller::ScheduleShutdown`) el traductor las **copia dentro** de
quien las llama, y otras las llama por una versión "sin estado" (`_statefree`) que no pasa por el gancho. Y
`SectionMgr::ExitSection` pide el apagado y **se queda esperando adentro** hasta que termina: un gancho que mira "al
volver" no lo ve. Por eso el osciloscopio de memoria fue la herramienta decisiva.

#### 58.6 Volver a entrar: el perfil tiene que ser siempre el mismo

Con el escenario "el que se une queda quieto → lo saca el anti-AFK → vuelve a buscar", la consola recibía
"Communication error… Error Code: 60000" al reconectarse. El WFC le daba un **perfil nuevo** en cada entrada
(600000510, 511, 512…), pero la consola guarda en su partida el perfil de la primera vez y, si no coincide, corta.

Arreglo: el perfil (y el apodo) salen de una cuenta fija (MD5) sobre el identificador de la consola (`userid` +
`gsbrcd`, lo que manda al NAS). La misma consola recibe siempre el mismo perfil, en cualquier sesión y con cualquier
pestaña de servidor, sin guardar nada. Si la misma consola entra de nuevo, se cierra su conexión vieja.

#### 58.7 Resultados

| Prueba (dos pestañas, `wfc-dos.mjs`, ~20 min) | Resultado |
|---|---|
| Entrar a Retro WFC (NAS, GPCM, QR2, SAKE) | "Welcome to Retro Wi-Fi Connection!", menú Wi-Fi |
| Encontrarse (lista de salas cifrada + NATNEG) | sí, en ~1 s |
| Sala → votación → carrera | sí; ~36 paquetes UDP/s por sentido, 0 perdidos |
| Carrera entera con el anfitrión en piloto automático | 2:50, resultados (sección 0x58) |
| El que se une quieto | lo saca el anti-AFK a los ~30 s (lo correcto) |
| Volver a entrar (perfil fijo) | sin error 60000; se junta de nuevo con el anfitrión |
| Carreras seguidas | **3 carreras** (22:07, 22:12, 22:17) con sala y votación entre medio |
| Ritmo | ~60 cuadros/s en las dos pestañas |

#### 58.8 Lo que sigue

- **CPU de relleno en línea** (pedido del dueño): el anfitrión simula los CPU y los manda por la red como jugadores. El
  juego ya admite 2 jugadores por consola en línea (el "invitado"); para llegar a 12 con pocos humanos hay que extender
  el paquete de carrera (`RKNet::PacketMgr`).
- **VR en Firebase**: Retro Rewind guarda el VR en `RRRating.pul` (ya viaja con la partida en la nube); falta publicarlo
  por jugador para la sala y la búsqueda.
- **Salas como BT3**: Firebase para presentar a los navegadores + WebRTC entre ellos, en lugar de BroadcastChannel.
- La sala de la página (`sala.mjs`: cola de pistas, 45 s, mirar mientras tanto) conectada al juego; 12 jugadores; pruebas
  del banco para la red.

**Comandos:**

```bash
python herramientas/compilar-web.py --modo navegador --salida build/web-red/navegador
MKW_DEPURAR=1 python herramientas/compilar-web.py --modo navegador --salida build/web-dep/navegador
MKW_BUILD=build/web-red/navegador node web/navegador/servidor.mjs
```

En el navegador: `?red=1` (una pestaña, red en memoria) o `?red=canal&nodo=2&anfitrion=1` y `?red=canal&nodo=3` (dos
pestañas que se ven por BroadcastChannel; la anfitriona corre el WFC).

## 2026-10-17 · §59 La malla WebRTC, su banco y el VR en Firebase

### 59.1 La malla WebRTC (F2): lo de verdad entre navegadores

En §58 dos pestañas se hablaban por BroadcastChannel (solo sirve dentro del mismo navegador). Para jugar entre
computadores hace falta **WebRTC**, como BT3. Piezas nuevas:

- `web/navegador/malla.mjs` — `crearMalla({ uid, senal, alBinario, alCambiar })`: una conexión WebRTC con cada otro
  navegador de la sala, con **dos canales de datos**: `udp` (sin orden, sin reintentos: lo que espera la carrera) y
  `tcp` (en orden, confiable: GPCM, HTTP). Ofrece el de uid menor (así nunca ofrecen los dos a la vez). Si el canal
  udp se atasca (más de 1 MB esperando), tira paquetes en vez de acumular retraso.
- El **buzón** (`senal`) es intercambiable: `senalPadre()` habla con la página del sitio por `postMessage` (el mismo
  protocolo de BT3: la página del sitio tiene Firebase y pasa los mensajes); `senalCanal()` es un buzón falso por
  BroadcastChannel para el banco.
- `crearRouterMalla()` en `red.mjs`: cada navegador anuncia sus IPs (`{t:'ips'}`) por el canal tcp a cada par nuevo;
  así sabe a quién mandar cada paquete. Cuando un par se va, se olvidan sus IPs.
- `mkw.mjs`: modo `?red=malla&nodo=N[&anfitrion=1][&sala=…]`.

**Resultado con el juego (dos pestañas de Chrome, cada una con su malla):** rutas aprendidas en 1,2 s, se encuentran,
sala, carrera; ~36 paquetes/s por sentido, 0 perdidos. Igual que con BroadcastChannel.

### 59.2 El banco de la red (`banco/pruebas/red`, 20 puntos)

Sin el juego: la pila (eco UDP, 50 KB de eco TCP, conexión rechazada), el WFC con una **consola falsa**
(`banco/pruebas/red/consola-falsa.mjs`: NAS con el base64 de la Wii, GPCM con la cuenta MD5 de GameSpy, el mismo perfil
al volver a entrar, otro perfil para otra consola, QR2 con su reto), enctypeX ida y vuelta y el filtro de salas, y la
**malla WebRTC de verdad** entre dos "navegadores" en la misma página (UDP y TCP a través de la malla, 200 paquetes de
205 bytes sin pérdidas, entrega directa dentro de una pestaña, rutas olvidadas al salir).

**Trampa encontrada por el banco:** si el servidor habla primero (GPCM saluda apenas uno se conecta), los bytes que
llegaban antes de que el código JS se pusiera a escuchar se perdían. Con el juego no se notaba (el juego lee por su
socket, que sí los guarda), pero era un error de la pila: ahora `alRecibir` entrega primero lo que ya había llegado.

### 59.3 El VR y el BR en Firebase

**Qué hace Retro Rewind con el VR** (leído en su código traducido, `rr_kamek_8182BAF0` y vecinos, y en sus textos):

1. Lo **calcula** cada consola al terminar una carrera en línea y lo guarda en `RRRating.pul` (memoria interna).
2. Lo **informa** al servidor por GPCM: `\wl:report\\wl:mkw_vrbr\vr=5000|br=5000\final\`.
3. Al entrar en línea **pregunta** el guardado: `GET http://nas.play.rwfc.net/api/mkw_rr_ratings?pid=<perfil>`.

Para contestar bien hubo que averiguar el formato exacto (paso a paso, porque la primera respuesta no funcionaba):

| Prueba | Qué se vio | Conclusión |
|---|---|---|
| Respuesta `{"found":true,"vr":777700,…}` | el juego siguió con 5000 | algo no le gustó |
| "Punta" en memoria: un byte que su función de respuesta pone en 0 al empezar | pasó a 0 a los 20 ms del pedido | la función **sí corre** |
| Buscar el texto de la respuesta en la memoria de la Wii | estaba copiado entero en la memoria de la función | la respuesta **llegó** |
| Leer las variables locales de esa función (su marco de pila) | JSON leído bien; "found" = 0 | falla en "found" |
| Leer su lector de "found" (`rr_kamek_81824900` → `818243B0`) | usa el **lector de números** | quiere `"found": 1`, no `true` |
| Mirar `RRRating.pul` | `RRRT`, perfil, `0x42480000` = 50,0 | el VR va **dividido por 100**, en coma flotante |

Así que la respuesta correcta es `{"found":1,"vr":7777,"br":6543}` (el juego divide por 100 y guarda 77,77). **Con el
juego de verdad:** la página le presentó VR 7.777 / BR 6.543 al WFC; el juego preguntó al entrar y su `RRRating.pul`
quedó con `0x429B8A3D` (77,77) y `0x4282DC29` (65,43). Funciona.

**El circuito completo** (`web/navegador/vr.mjs`):

```
 Firestore mkw_vr/{uid} --(al entrar: vr.cargar)--> página --(UDP al puerto 27999 del WFC, hasta que diga "ok")--> WFC
 juego --(GET /api/mkw_rr_ratings?pid=…)--> WFC --{"found":1,"vr":…}--> juego (lo guarda en RRRating.pul)
 juego --(GPCM \wl:mkw_vrbr\vr=…|br=…, después de cada carrera)--> WFC
   └─ el ESPÍA de la pila de la página lo ve pasar --> vr.informar --> localStorage + Firestore (solo si cambió)
```

- Cada página escribe **solo su** documento (reglas en `docs/firebase-mkw.md` §5). El WFC, que corre en la pestaña del
  anfitrión, no escribe en Firebase: solo recuerda el VR de cada IP y perfil para contestar.
- Sin sesión: el VR queda en el navegador y en `RRRating.pul` (que ya viaja con la partida en la nube); al iniciar
  sesión, si la nube no tenía nada, sube el local.
- «Tu partida» ahora muestra el VR de Retro Rewind (de `RRRating.pul`, por ID de perfil), no el del juego base que
  queda en `rksys.dat` (`leerRating` en `licencias.mjs`).
- La sala del sitio llama `window.mkwConectarVr({ almacen: almacenFirestoreVr({ fs, db }), uid, nombre })` **antes** de
  entrar en línea.

**Pruebas:** `banco/pruebas/vr` (20 puntos: formato del juego, un aparato sube y otro baja, sin sesión, reglas, tabla,
y con el WFC: presentar → preguntar → informar → la nube cambia); `banco/pruebas/licencias` (+2: leer `RRRating.pul`).

```bash
node banco/correr.mjs red vr licencias
```

## 2026-10-17 · §60 La sala del sitio: Mario Kart como juego de sala, igual que BT3

**Qué se hizo** (en la copia del sitio, `terceros/Paginita-Pro`, rama `claude/loving-planck-9k2yam`; nada publicado):

- `colabtex/src/juegos/motor.js`: `JUEGOS.mkw` (1 a **12** jugadores) y el reductor `redMkw`. Al registro va solo el
  vestíbulo: `ajuste` (la CPU de relleno), `anfitrion` (pasar el puesto), `empieza`, `vuelve`, `abandona`. Si el
  anfitrión se va, el puesto pasa al siguiente y, si corrían, vuelven todos al vestíbulo (su pestaña era el servidor).
  Cada jugador tiene su nodo fijo (2 + orden de llegada).
- `colabtex/src/juegos/mkw.js` (nuevo, el cartero): el vestíbulo (pilotos con su VR, CPU de relleno, «¡A correr!»,
  «Volver al vestíbulo», «Pasar anfitrión»), el marco del juego solo mientras corren y solo para los jugadores, el
  buzón `vivo/<pid>/rtc` prestado por postMessage (el mismo código que BT3), y los almacenes de VR y récords sobre la
  Realtime Database del sitio, que le pasa al marco apenas carga.
- `juegos-main.js`, `logros.js` (10 logros propios: la sala no clasifica, como BT3), `monedas.js`, `salon-datos.js`
  (género «Carreras»), `ocultos.js` y `bt3-amigos.js` (**privado**: solo los amigos de la lista del Worker, igual que
  BT3), el manual 📖 con ejemplos y dibujos propios, la portada (bandera a cuadros y el nombre en letras nuestras) y el
  estilo del vestíbulo en `juegos.html`.
- `firebase/database.rules.json`: `'mkw'` en la lista de juegos y de logros, el tope de `cupo` de 10 a **12**, y el nodo
  `mkw` (`vr`, `records`). Nota para el dueño en `firebase/CONFIGURAR-FIREBASE.md` (**hay que publicarlas a mano**).
- `colabtex/tests/mkw.test.cjs` (8 pruebas) en `npm run test:juegos`.

**Por qué Realtime Database y no Firestore:** al revisar el sitio se vio que no usa Firestore (no tiene ni reglas de
Firestore); el VR y los récords (§57, §59) pasaron a `mkw/vr/{uid}` y `mkw/records/{pista}-{cat}/{uid}` para no obligar
a activar otro producto (`almacenRtdbVr` en `vr.mjs`, `almacenRtdb` en `records.mjs`, `docs/firebase-mkw.md` §4–6).

**El juego entra solo** (`menus.mjs`, `enLinea`): con `?modo=enlinea` el piloto va del título a «VS mundial»; quien no
es anfitrión espera a tener ruta al WFC de la sala por la malla antes de conectarse. Y un **vigilante**: si un juego
lleva 100 s buscando sin juntarse, cancela y vuelve a buscar (en 9 corridas pasó una vez que los dos quedaron
buscando para siempre).

**Pruebas:**

| Prueba | Resultado |
|---|---|
| `colabtex` `npm run test:juegos` | 883 bien, 8 mal — las 8 ya fallaban antes (Worker de BT3 y una del salón) |
| `node web/navegador/prueba-enlinea.mjs` (dos pestañas, malla WebRTC, sin tocar teclas) | 9 de 9 en 8 de 9 corridas (también con B entrando antes que A); se juntan a los ~40 s de buscar |
| `node web/navegador/prueba-enlinea.mjs --sala` (el juego dentro de una sala del sitio falsa, `banco/pruebas/sala-mkw/padre.html`) | **11 de 11**: buzón por postMessage, y cada juego recibió el VR de su cuenta (6.789 y 7.100) |

**Falta:** la CPU de relleno en línea (la sala ya la elige, el juego todavía no la pone), que el dueño publique las
reglas, y el Worker que sirve el programa (`juegos/mkw/privado.json` con su dirección).

```bash
node web/navegador/prueba-enlinea.mjs [--sala]
cd terceros/Paginita-Pro/colabtex && npm run build && npm run test:juegos
```

## 2026-10-18 · §61 La carrera sincronizada: la sala con CPU de relleno

**Qué se quería:** que una sala en línea pueda llenarse con CPU (lo pidió el dueño: «tiene que tener la habilidad de
rellenar con CPU»). El modo en línea del juego (§58) no tiene CPU; el modo **VS offline** sí. La idea: cada navegador
corre la misma carrera VS offline con 12 karts (los humanos + CPU), y en cada cuadro todas las consolas usan los mismos
botones de cada humano. Eso es un **lockstep** (ver el glosario): solo viajan los botones (8 bytes por cuadro y humano).

**Las piezas:**
- `web/navegador/lockstep.mjs`: junta los botones de todos para cada cuadro y responde cuando están; cada paquete
  repite los últimos 16 cuadros (si se pierde uno, el siguiente lo trae) y lo que falta se pide de nuevo. Cada 120
  cuadros compara la **huella**. Si alguien se va, el **decisor** corta su kart en **dos pasos** (primero pregunta a
  todos hasta dónde tienen, después corta después del último). Al que todavía no llegó a la carrera se le espera
  hasta 45 s (cada uno carga a su ritmo); al que estaba y se calla, 4 s.
- `web/navegador/pad_web.cpp`: en la carrera, cada vez que el juego lee los mandos en un cuadro nuevo, le pide los
  botones a `lockstep.mjs` y **espera** (JSPI suspende el juego) hasta tenerlos. Apunta la cámara al kart propio.
- `web/juego/semillas_nativo.cpp` (en `RacedataScenario::InitRng`): escribe las semillas, enciende el reloj fijo y el
  **plantel** (personaje, vehículo y el mando de cada humano en su puesto).
- `web/juego/lockstep_nativo.cpp`: memoria nueva en cero, "todo a la vista", los CPU no miran la cámara (los dos
  últimos se pueden apagar con `?arreglos=0` para comparar), y el **HUD** de cada consola muestra su kart
  (`CtrlRaceBase::GetPlayerId` y `CtrlRaceTime::GetPlayerId` devuelven mi puesto).
- Runtime (`ppc_helpers.cpp`, `os_time.cpp`): `PPC_MftbCarrera` y la hora del juego por cuadros en la carrera.

**La desincronización que costó encontrar:** con todo eso, una carrera offline salía idéntica dos veces seguidas en
la misma consola (incluso con la CPU frenada 2×), pero dos pestañas se separaban hacia el cuadro 1.200. El
experimento decisivo: dos corridas con la misma tabla de pantallas pero la cámara mirando a otro kart → idénticas
2.519 cuadros (solo cambió el azar "visual" de las animaciones de los pilotos). Conclusión: lo que separaba la carrera
era la **tabla de pantallas** de Racedata (cada consola le daba la pantalla a su kart), no la cámara: la miran también
la lógica de fin de carrera, Lakitu, los efectos y el sonido. Arreglo: la tabla queda igual en todas (puesto 0) y cada
consola solo mueve su cámara (`RaceCameraMgr` → cámara +0x9C) y su HUD a su kart.

**El banco nuevo** (`banco/pruebas/lockstep`, sin el juego): consolas falsas con un "juego" que mezcla los botones
de cada cuadro en un número, y una red falsa con 5–40 ms de latencia y 1 de cada 7 paquetes perdidos. Encontró un error
real: cuando alguien se iba, una consola podía haber usado sus últimos botones mientras el decisor (que no los había
recibido) cortaba antes → las dos cortaban en el "mismo" cuadro pero una había usado botones de verdad. De ahí el corte
en dos pasos (5 de 5 salidas bien, cada una en un cuadro distinto).

**El piloto de los menús** (`menus.mjs`), tres arreglos que destaparon las pruebas:
1. Los toques de la lista de modos a veces se perdían o contaban doble (se fue a Batalla, página 0x75): ahora cada
   toque se sostiene **6 cuadros del juego** apretado y 6 suelto, no solo 110 ms.
2. Lazo cerrado del modo: si en Batalla o en personajes el modo que quedó no es el pedido, vuelve atrás y corrige.
3. **Bug real que vio el dueño** («los demás modos abren el juego desde el inicio»): el aviso del sonido bloqueado dice
   «aprieta una tecla», y cualquier tecla detenía al piloto, que se quedaba en el título. Ahora solo **Esc** (o Start
   en un mando) toma el control, y el aviso lo dice.

**Pruebas:**

| Prueba | Resultado |
|---|---|
| `node banco/correr.mjs lockstep` (red mala, alguien se va ×5, llega tarde, el decisor nunca llega, carrera nueva, desync a propósito, plantel) | **25/25** (3 corridas seguidas) |
| `node web/navegador/prueba-sincro.mjs` (dos pestañas con el juego, 10 CPU, cada una con su teclado) | **9/9**: 15 de 15 huellas iguales, cámara y HUD de cada una en su kart, espera promedio 0,2–0,4 ms por cuadro |
| Piloto con una tecla apretada durante la carga (guion propio) | llega a la lista de pistas a los 9 s (antes: se quedaba en el título) |

**Medición en el PC** (`medir-sitio.mjs --perfil pc`, 2 visitas): 60 fps; CPU 9,0–9,4 ms por cuadro (ayer 8,0–8,2: hay
~1 ms más que falta explicar, sigue dentro del presupuesto de 16,7 ms). La primera visita tiene más tirones (9 en 20 s)
porque la tarjeta de video compila en segundo plano los ~600 "pipelines" de la semilla; la segunda, 1. Los tirones que
vio el dueño jugando coincidieron además con una compilación del juego y una prueba de dos Chrome corriendo a la vez en
el mismo PC.

**Perfil `celular-alto`** (Pixel 7 con la CPU 2,5× más lenta): 67 ms por cuadro, 8 veces el PC y no 2,5: el freno de
Chrome no es parejo, así que la emulación subestima a los celulares (lo notó el dueño). Los celulares quedan para una
versión futura (pedido del dueño); el día que toque, medir en uno real con `adb reverse tcp:8140 tcp:8140`.

**Falta:** el sonido sigue al kart del puesto 0 en todas las consolas; una vez (de 6 corridas) el juego de A se cayó
al empezar la carrera en `Effects::Player::UpdateNonItemEffects` (no se repitió); conectar la sala del sitio (elegir la
carrera sincronizada cuando hay CPU de relleno y hasta 4 humanos: el mando de GameCube tiene 4 puertos); el ~1 ms de
CPU de más.

```bash
node banco/correr.mjs lockstep
node web/navegador/prueba-sincro.mjs [--lento] [--extra=&arreglos=0]
node herramientas/medir-sitio.mjs --perfil celular-alto --etiqueta X
```

## 2026-10-18 · §62 La carrera sincronizada en la sala del sitio, y las dos desincronizaciones escondidas

**Qué se quería:** que la sala del sitio use la carrera sincronizada (§61) cuando hay CPU de relleno, que la copa
completa (4 carreras) llegue al final igual en todas las consolas, y que el modo en línea "funcione sí o sí" (lo
pidió el dueño). Con eso andando aparecieron dos desincronizaciones que solo se veían a veces: costó encontrarlas
porque la carrera se separaba recién a los 2 min 20 s y no en todas las corridas.

### 62.1 La sala del sitio elige la carrera sincronizada

- `colabtex/src/juegos/motor.js` (Paginita-Pro): si la sala tiene CPU de relleno y hasta 4 humanos
  (`MKW_SINCRO_MAX`: el mando de GameCube tiene 4 puertos), al apretar «¡A correr!» se congela la lista de quiénes
  corren (`est.sincro`) y `mkwCarrera(pid, ronda)` saca de la semilla de la sala la semilla de la carrera y 4 pistas
  distintas (copa < 79). Si el anfitrión se va en medio, la ronda sigue (ya no se vuelve al vestíbulo).
- `colabtex/src/juegos/mkw.js`: el iframe del juego se abre con `modo=copa&sincro=…&semilla=…&pistas=…&cpu=…` solo
  para los que están en `est.sincro`. Pruebas: `colabtex/tests/mkw.test.cjs` (10/10).
- El banco de la sala (`banco/pruebas/sala-mkw/padre.html`) arma la misma dirección para probarlo sin el sitio.

### 62.2 El fin de la carrera, la vista propia y el piloto

- **Fin de carrera** (`GMDataVS::CanRaceEnd`, 0x80536054, envuelta en `lockstep_nativo.cpp`): el juego terminaba la
  carrera cuando llegaba el kart del puesto 0 (el de la pantalla). Ahora termina cuando llegaron **todos los humanos
  que siguen en la sala** (RaceinfoPlayer +0x38 bit 0x2), igual en todas las consolas.
- **El contador de cuadros** se lee de +0x1E (16 bits) + +0x20: al terminar la carrera el byte alto de +0x1C se llena
  de marcas y el número salía basura. El lockstep se detiene en la etapa ≥ 4 (resultados): esos menús son locales.
- **La carrera 2 de la copa** (`pad_web.cpp`, `CuadroDeCarrera`): la carrera siguiente se arma con un «Scene
  Restart» y su Raceinfo puede quedar en la **misma dirección** que el de la anterior. El código solo reconocía una
  carrera nueva si cambiaba la dirección, así que en la carrera 2 el lockstep no se enganchaba (cada consola corría
  sola). Ahora también es carrera nueva cuando el mismo Raceinfo vuelve a la etapa < 4 después de haber terminado.
- **Vista propia** (`VISTA_PROPIA` en `compilar-web.py`): en 16 funciones de **sonido** y **HUD** la pregunta "¿de
  quién es la pantalla?" (`Racedata::GetPlayerIdOfLocalPlayer`) se reemplaza por `mkw_vista_propia_v0` = mi puesto.
  La tabla de pantallas sigue igual en todas (la lógica la mira, §61); solo lo que se oye y se ve sigue a mi kart.
  `?vista=0` apaga sonido+HUD propios, `?camara=0` la cámara propia (para comparar).
- **Piloto** (`menus.mjs`): en la carrera sincronizada aprieta A 6 s después del fin hasta que aparece la lista de
  copas, para que la copa siga sola; `records.mjs` guarda el tiempo de MI kart.
- `jugar.bat`: doble clic → servidor del juego + Chrome en http://127.0.0.1:8140/.

### 62.3 Primera desincronización: la "compensación de lag" de Retro Rewind

**El síntoma:** con la semilla de una sala real (2121618600, pistas 50.2/50.0/65.3/45.0) dos corridas offline de
la misma carrera, en la misma PC, se separaban 3 de cada 4 veces, siempre en los mismos cuadros (8.484 o 8.768).

**Cómo se encontró** (cada paso con su herramienta, todas en la carpeta temporal de la sesión):
1. Huella por cuadro de cada kart, del azar 1 (el de la lógica) y del azar 2 → el azar 1 se separaba en el cuadro
   8.484 por una decisión de la IA de un CPU (`AI::PlayerKart::UpdateAction1`): en una corrida usa una acción en el
   8.484 y en la otra otra acción en el 8.490.
2. Huella de la IA de cada CPU por cuadro (sin contar punteros: las direcciones cambian de una corrida a otra) →
   idéntica hasta el 8.484: lo que cambia es algo de afuera que la IA consulta.
3. Comparar el kart 6 entero → una matriz de posición (la del **modelo** del kart, `K+3c +0xC8`) tenía en una corrida
   la posición de este cuadro y en la otra la del cuadro anterior (82 unidades atrás).
4. **Punto de vigilancia** (ver glosario): un build aparte (`--carpeta build/web-vigia`, `-DMKW_VIGIA`) que avisa
   cada escritura en una dirección, con la pila de llamadas. La matriz la escribe `ModelDirector::Update`, y a
   esa la llama **el dibujo** (`GameScene::draw` → `ScnMgr::DrawMain`), no la lógica.
5. Registro de en qué cuadros se dibuja → en algunos cuadros el juego **no dibujaba**: corría la lógica dos veces
   seguidas. Quien lo decide es Retro Rewind (Pulsar): reemplaza el bucle principal (`RKSystem::Run`, el
   `rr_overlay_8000951C`) y en 0x800095C4 llama a `rr_kamek_81806568`, que mira cuántos refrescos de pantalla
   **reales** pasaron (AsyncDisplay +108) y, si el juego va atrasado, se salta el dibujo para alcanzar al reloj.

**Por qué separa la carrera:** cada PC se salta cuadros distintos según lo cargada que esté; en los cuadros sin
dibujo la copia de la posición en el modelo queda atrasada, la IA de los CPU la lee, y decide otra cosa.

**El arreglo** (`lockstep_nativo.cpp`, `rr_kamek_81806568`): en la carrera sincronizada se hace lo del juego
original: si el bucle quiere dibujar, se empieza el cuadro de pantalla (`AsyncDisplay::beginFrame`) y se dibuja
siempre. Una PC que no da abasto va más lenta y la sala la espera (es lo que hace el lockstep de todas formas).
Fuera de la sala con CPU no cambia nada. De paso, `AsyncDisplay::beginFrame` guarda en +100 una fracción medida con
el reloj real; en la carrera sincronizada queda fija en su tope (también la usaba la animación de los pilotos).

### 62.4 Segunda desincronización: el reloj del sorteo compartido

**El síntoma:** con el dibujo arreglado, las dos corridas seguían separándose, ahora siempre en el 8.484. La huella
de los **objetos** de cada jugador (`ItemPlayer`, 584 bytes cada uno) mostró dónde: en el cuadro 8.419 el CPU 6
toca una caja y le sale el objeto 5 en una corrida y el 4 en la otra (`ItemPlayer +0x74`).

**Por qué:** el sorteo de los objetos saca su azar del reloj del procesador, que en la carrera sincronizada es el
reloj fijo de §61 (`PPC_MftbCarrera`). Pero era **un solo contador para todo el juego**: cada lectura, venga de
donde venga, lo avanza un paso. Con que alguna parte lo lea una vez de más en una PC (cualquier cosa que arme un
`Random` nuevo, por ejemplo), todos los números siguientes se corren y la caja da otro objeto.

**El arreglo:** un **reloj por lugar** (`PPC_MftbCarreraEn(sitio, lr)` en `ppc_helpers.cpp`). Cada una de las 8
funciones de `RELOJ_CARRERA` tiene su número (sitio) y se le pasa el `lr` del momento (desde dónde la llamaron). El
valor sale solo de: el cuadro de la carrera, el sitio, el lr y cuántas veces leyó ese mismo lugar en ese cuadro.
Sigue subiendo con el tiempo para cada lugar (las que miden cuánto pasó lo ven avanzar), y una lectura de más en
un lugar ya no mueve a los otros. `GetTick` tiene además una versión "sin estado" (`func_80550730_statefree`) que no
tiene `ctx`: ahí el lugar es solo la función.

### 62.5 Lo que se descartó por el camino

- **El lugar en la memoria:** en cada corrida todas las piezas de la carrera quedan corridas de a 32 bytes (por lo
  que pasó antes en los menús). Se pensó que alguna parte del juego dependía de las direcciones, pero una pareja con
  Raceinfo en la **misma** dirección también se separó. No era eso.
- **El azar 2** (Raceinfo +8) lo usa solo la animación de los pilotos (dos funciones con `Random::next` copiado
  adentro: 0x807C6A44 y 0x807CB530): no toca la carrera.
- La comparación de toda la memoria entre corridas no sirvió: aun antes de separarse hay ~100.000 palabras distintas
  (punteros, gráficos, sonido).

### 62.6 Pruebas

| Prueba | Antes | Ahora |
|---|---|---|
| Misma carrera offline 2 veces (semilla de la sala, 12 CPU, ~9.190 cuadros), 4 parejas | 3 de 4 separadas (cuadro 8.484/8.768) | **4 de 4 idénticas** (karts, azar 1, azar 2 y objetos) |
| `prueba-sincro.mjs --copa --pistas=50.2,50.0,65.3,45.0 --semilla=2121618600` (dos pestañas) | se separaba; después de §62, se congelaba al terminar la carrera 1 (§63) | **4 de 4**: las dos pasan solas a la carrera 2 (cuadro 1.035) con las huellas iguales en toda la copa (95 de 95) |
| `prueba-sincro.mjs --sala --copa` (dentro de la sala falsa del sitio) | la carrera no terminaba (los humanos no se movían: §63) | **4 de 4**: carrera 2 en las dos (cuadro 956), huellas iguales (82 de 82) |

**Trampas:** el `EM_ASM` de C++ se come las barras invertidas (`/(\d+)/` llega a JavaScript como `/(d+)/`): usar
`[0-9]`. Y `Error.stackTraceLimit` es 10 por omisión: para ver la pila completa hay que subirlo.

```bash
node web/navegador/prueba-sincro.mjs --copa --pistas=50.2,50.0,65.3,45.0 --semilla=2121618600
node web/navegador/prueba-sincro.mjs --sala --copa [--minutos=25]
MKW_DEPURAR_LS=1 MKW_CFLAGS_EXTRA=-DMKW_VIGIA python herramientas/compilar-web.py --modo navegador --carpeta build/web-vigia
```

## 2026-10-18 · §63 La página que se congelaba al terminar la carrera en línea

**El síntoma:** en la prueba de la copa sincronizada (`prueba-sincro.mjs --copa`) la carrera 1 terminaba igual en las
dos pestañas (87 de 87 huellas), pero ninguna pasaba a la carrera 2: se quedaban en la pantalla de puntos. Y la
prueba, que tiene un tope de 25 minutos, tardó **casi dos horas**: el reloj de la página saltó de 222 s a 6.885 s
entre dos líneas del medidor.

**Cómo se encontró:**
1. En el registro, después del fin de la carrera, había ~14.500 líneas de `[pipelines]` (una por segundo: ~1 h 50 min)
   y **ninguna** del medidor, que es un `setInterval` de la página. Es decir: el juego seguía corriendo (60 cuadros
   por segundo, imprimiendo), pero el **bucle de eventos** de la página no corría nunca. Por eso tampoco llegaban dos
   pipelines pedidas en segundo plano ("2 en camino" durante 6.667 s: su respuesta necesita el bucle de eventos) y la
   prueba no podía leer la página (`page.evaluate` no volvía, así que nunca llegaba a mirar su tope de tiempo).
2. Una prueba propia que lee cada pestaña con tope de 4 s y un **latido** (glosario) lo confirmó: durante la carrera
   los huecos eran de 120 a 700 ms (la página respiraba a ratos) y, apenas terminó la carrera (cuadro 10.504),
   las dos pestañas dejaron de responder del todo.
3. La causa está en cómo espera el runtime entre cuadros (`vi.cpp`). En línea (`?red`) la página **no ofrece el
   enganche al monitor** (§58: el juego debe ir con el reloj de pared). Sin enganche, la espera iba en rebanadas de
   1 ms (`SleepPreciselyUntil(ahora + 1 ms)`) y el runtime solo cede con `emscripten_sleep` si faltan **2 ms o más**:
   nunca cedía, giraba toda la espera. Y la pausa de presentar de aurora (la otra ocasión de ceder) también estaba
   apagada en línea. Durante la carrera sincronizada la página solo respiraba cuando el lockstep esperaba los
   botones de la otra consola. Terminada la carrera, el lockstep ya no espera a nadie: **nada cedía nunca más**.

**Qué significa para el jugador:** no era solo la prueba. En cualquier sala en línea (la carrera sincronizada y el VS
por el WFC de la sala) la página casi no actualizaba la pantalla ni atendía la red ni el teclado durante la carrera,
y al terminar la carrera sincronizada quedaba congelada.

**El arreglo** (dos partes):
- **Esperar sin enganche cediendo** (`vi.cpp`, `PaceToRetraceBoundary` y `VI_HLE_WaitForNextRetracePoll`): si el
  reloj no va enganchado al monitor, el runtime le pide a la página `Module.mkwEsperaReloj(vencimiento, 1 ms)`
  (`mkw.mjs`, `esperaReloj`): la página lo despierta cuando falta ≤ 1,5 ms (el runtime gira ese resto) o a 1 ms para
  que atienda sonido y alarmas. El `setTimeout` se pide desde una tarea nueva (sin el mínimo de 4 ms de los
  temporizadores anidados). En una pestaña oculta solo cede una vuelta (Chrome demora ahí los `setTimeout` hasta 1 s y
  la sala no puede esperar). Sirve también para una pestaña normal cuyo reloj del monitor dejó de valer.
- **La pausa de presentar también en línea** (`mkw.mjs`, `PRESENTA`): `mkwEsperaToma` y la toma a compás no tocan el
  reloj del juego (solo esperan a que el navegador tome el canvas, con tope en el vencimiento del cuadro), así que
  ahora van también con `?red`. Sin ella, cuando un cuadro tardaba más que su turno no había ninguna espera y la
  página seguía sin turno.

**Resultados** (dos pestañas: una prueba de la sesión que lee cada pestaña con tope y latido; una pestaña: `node herramientas/medir-enlinea.mjs "" "&esperaToma=0&atrasada=0"` y `SIN_RED=1 node herramientas/medir-enlinea.mjs`):

| Medida | Antes | Solo la espera nueva | Las dos partes |
|---|---|---|---|
| Fin de la carrera 1 de la copa (dos pestañas) | **las dos se congelan** | pasan solas a la carrera 2 | pasan solas a la carrera 2 |
| Hueco máximo del latido de 100 ms en carrera (dos pestañas) | 120–700 ms | 120–400 ms | **113–137 ms** |
| Una pestaña en línea (lo que tiene cada jugador): refrescos con cuadro nuevo / repetidos / saltados (monitor de ~175 Hz: lo ideal es 34,3 % / 65,7 % / 0 %) | — | 40,6 % / 59,1 % / **0,4 %** (el navegador pierde turnos de pantalla) | **34,8 % / 65,2 % / 0 %** (igual que sin red: 34,3 / 65,7 / 0) |
| Cuadros por segundo del juego, una pestaña en línea | — | 60,0 | **59,9** |

Con **dos pestañas en el mismo PC** la carrera sincronizada va ahora a ~51 cuadros por segundo (antes ~60): ahora el
navegador sí lleva cada cuadro a la pantalla, y dos juegos en el mismo PC se reparten la CPU. Con un jugador por PC
(lo real) va a 60 y parejo, como se ve en la tabla.

**Además, en las pruebas:**
- `prueba-sincro.mjs`: cada lectura de la página tiene tope de 10 s y avisa "la página no responde"; así una página
  colgada ya no deja la prueba corriendo horas.
- `prueba-sincro.mjs --sala --copa`: la sala falsa (`banco/pruebas/sala-mkw/padre.html`) acepta `?extra=` y le pasa
  al juego `autoconducir=1`; antes, dentro de la sala, los karts de los humanos no se movían y la carrera no
  terminaba nunca (a los 25 min iba por el cuadro 75.000).
- `prueba-enlinea.mjs` usaba un build aparte y viejo (`build/web-red`, del 17 de octubre): ahora usa el de siempre,
  que ya trae la red del juego.
- `banco/correr.mjs` aprieta el botón «empezar» de las páginas que necesitan el primer toque (la del sonido no
  terminaba nunca: 21 de 21 páginas bien).

**Optimización que salió de esto: la espera sin margen.** Con la espera nueva, el perfil de 10 s de carrera
(`guion.mjs … P:10000 --llamadores "_emscripten_get_now,_clock_time_get,now"`) mostró que ~8 % de todo el tiempo de la
pestaña se iba en **leer el reloj** (`_emscripten_get_now`, `now`, `_clock_time_get`, `bigintToI53Checked`,
`wasm-to-js`), casi todo desde el bucle ocioso del juego (`SelectThread`): el último 1,5 ms de cada espera giraba
preguntando la hora miles de veces. Pasa en todo monitor que **no se puede enganchar**: los 60 Hz del juego
(16,68 ms) tienen que ser un número entero de refrescos, y en uno de 175 Hz (el de este PC hoy), 144 o 165 Hz no lo
son, así que el juego espera "sin enganche" también fuera de línea. Ahí no hay refresco con el que calzar y llegar un
poco tarde no corre el reloj del juego (cada "tele" se sella en su lugar de la grilla: `lastRetrace = target`), así
que la página ahora despierta al juego **en** el vencimiento (el último tramo del `setTimeout` redondeado hacia arriba,
sin margen) y el runtime casi no gira.

| Perfil de 10 s de carrera (monitor de 175 Hz) | Margen de 1,5 ms | Sin margen |
|---|---|---|
| Leer el reloj | ~8,4 % | **~0,5 %** |
| Ocioso (la pestaña libre) | 54–56 % | **65 %** |
| Hilo principal ocupado (`medir-sitio --perfil pc`) | 46–52 % | **41–47 %** |
| CPU por cuadro del juego + aurora (no cuenta las esperas) | 8,4–9,1 ms | 8,5–9,3 ms (igual, dentro del ruido) |

Es decir, ~1,7 ms por cuadro que el procesador ya no quema girando (menos consumo y más lugar para la página), sin
cambiar el trabajo del juego. La pantalla sigue igual de pareja (`medir-enlinea.mjs`, una pestaña, 60 s de carrera):
sin red 34,4 % de refrescos con cuadro nuevo / 65,6 % repetidos / **0 % saltados** (lo ideal a 175 Hz: 34,3 / 65,7 / 0);
en línea 35,3 / 64,7 / **0**, 60 cuadros por segundo en las dos.

**Trampa:** "el juego va a 60 cuadros por segundo" (el medidor) no quiere decir que la pantalla los muestre: el
medidor cuenta los cuadros que el juego le entrega a aurora. Que lleguen a la pantalla depende de que la página tenga
turno. Lo que lo mide es `mkwEstado.vsync` (refrescos con cuadro nuevo justo, repetidos y saltados).

```bash
python herramientas/compilar-web.py --modo navegador
node web/navegador/prueba-sincro.mjs --copa --pistas=50.2,50.0,65.3,45.0 --semilla=2121618600
node web/navegador/prueba-sincro.mjs --sala --copa
```

## 2026-10-18 · §64 El plan del dueño, el visor de Retro WFC fuera y el trabajo a salvo en git

**Qué pasó:** se revisó todo lo hecho y se escribió el plan de lo que falta (`PLAN.md`, "Lo que falta, en orden",
etapas A a F). El dueño contestó las preguntas abiertas:

| Pregunta | Respuesta del dueño | Qué cambia |
|---|---|---|
| ¿Commits en la rama del sitio y en el repo local? ¿Push y PR? | Commits sí. Push y PR primero sí, y después **no** ("dont pR", 19:50) | Commits locales; sin PR ni push hasta que él lo pida |
| ¿Qué Worker y qué lista de amigos para Mario Kart? | Los mismos de BT3; el Worker y la subida a R2 **los hace él** | Aquí se prepara todo lo que necesita (etapa B) y no se publica nada |
| ¿El VR se mueve en la carrera sincronizada con CPU? | **No: solo en línea** (VS por el WFC de la sala) | La carrera sincronizada no escribe VR en Firebase |
| ¿Se quita el visor de salas de Retro WFC? | Sí | Se borró `salas.mjs` y su página del banco (abajo) |
| ¿Cómo se prueban "dos PCs"? | Como BT3: dos juegos abiertos en el mismo PC | Bastan las pruebas de dos pestañas y una prueba a mano con dos ventanas |

**El visor de salas, fuera.** `web/navegador/salas.mjs` leía en vivo la lista pública de salas del servidor de la
comunidad (Retro WFC, en `rwfc.net`) y la mostraba en la página: quién estaba jugando, en qué sala, con qué VR. Como el
multijugador va **solo por nuestra página** (salas del sitio, el WFC virtual en la pestaña del anfitrión y la malla
WebRTC), el visor sobraba, y además hacía que la página dependiera de un servidor ajeno. Se borraron `salas.mjs`, su
página del banco (`banco/pruebas/salas/`) y su entrada en `banco/index.html`. **No** confundir con `wfc-salas.mjs`, la
lista de salas de nuestro propio WFC virtual, que sigue.

Lo único útil que tenía el visor era el **código de amigo** (12 cifras calculadas del número de jugador con un MD5,
§46): se pasó a un archivo propio, `web/navegador/codigo-amigo.mjs`, que ahora usa `licencias.mjs` («Tu partida»
muestra el código de cada licencia). Como su página del banco desapareció, sus pruebas se pasaron a la de licencias,
que subió de 21 a **26 puntos**:

| Punto nuevo (`banco/pruebas/licencias/`) | Qué comprueba |
|---|---|
| MD5 con los vectores del RFC 1321 | Que nuestro MD5 da lo mismo que el patrón publicado ("", "abc", "message digest" y 100 letras "a", que ocupa dos bloques) |
| 4 códigos de referencia | 4 números de jugador con su código ya conocido (verificados contra los 280 jugadores de Retro WFC el 17-10) |
| Un código bien escrito, en 3 formatos | Con guiones, con espacios y todo junto: los tres válidos |
| Un código con una cifra mal | Cambiar una cifra (en el número o en el control) lo hace inválido: el control "atrapa" el error |
| 11 cifras, letras o vacío | Inválidos, sin romper nada |

**Resultados de la etapa A (este PC, monitor de ~175 Hz):**

| Prueba | Resultado |
|---|---|
| Banco sin el juego (`node banco/correr.mjs`) | 21/21 páginas |
| Licencias (con el código de amigo) | **26/26** |
| Juego en Node (`prueba-arranque.mjs`, recompilado) | 13/13 |
| Navegador (`prueba-navegador.mjs 900`) | 20/20 (21 con un monitor que es múltiplo de 60 Hz; el punto "parejos en pantalla" solo se puede medir si se engancha) |
| Partidas / piloto / elegir | 6/6 · 9/9 · 23/23 |
| Sala con CPU, dos pestañas (`prueba-sincro.mjs`, normal y `--sala`) | 9/9 y 9/9 |
| Copa sincronizada (con semilla y dentro de la sala falsa) | 4/4 y 4/4 carreras |
| VS en línea por el WFC de la sala (`prueba-enlinea.mjs`) | 9/9 |
| Copa fuera de línea, 4 carreras (`prueba-copa.mjs`) | 10/11 la primera vez (la carrera 4 sin su semilla, abajo); **11/11** con el arreglo |
| Sitio: `npm run test:juegos` | 885/893; las 8 que fallan ya fallaban antes y no son de Mario Kart (7 del Worker del disco de BT3 y 1 del salón) |
| Sitio: `node tests/mkw.test.cjs` | 10/10 |

**Un error que destapó §63: la carrera 4 de la copa salía sin su semilla.** En «Copa a tu gusto» cada carrera
tiene su semilla (el número del que sale todo su azar, §56). La página la deja en `window.mkwSemillaCarrera` y el
juego la toma al **preparar** la carrera (`RacedataScenario::InitRng`, con el gancho de `semillas_nativo.cpp`). Al
terminar la copa, `mkw.mjs` borra esa semilla para que las carreras que vengan después tengan el azar de siempre. El
problema: lo borraba apenas el piloto (`menus.mjs`, `seguirCopa`) **llegaba** a la carrera 4, es decir, apenas el
juego empezaba a cargarla, y el juego la prepara un poco después. Antes de §63 la página casi nunca tenía turno en
ese momento (el juego no soltaba el hilo), así que el borrado llegaba tarde y "funcionaba" por suerte; ahora que la
página tiene turno a tiempo, el borrado ganaba y la carrera 4 salía con el azar del reloj (`4f96838f` en vez de
`6ae94d29`). Es una **carrera entre dos procesos** (como dos señales que llegan a un flip-flop sin sincronizar: el
resultado depende de cuál llega primero). **Arreglo:** `seguirCopa` no vuelve hasta que la carrera 4 está en pantalla
(su página de juego, 0x0D/0x0E; para entonces el juego ya preparó el azar), con tope de 60 s, y recién ahí se borra.
Resultado: `prueba-copa.mjs` **11/11**, la semilla de la carrera 4 es la pedida.

**Commits.** El trabajo quedó guardado en dos lugares:
1. **El sitio** (`terceros/Paginita-Pro`, rama `claude/loving-planck-9k2yam`): antes, `bash herramientas/subir-kit.sh`
   copia a `juegos/mkw/` todo lo propio de este proyecto (lo que git no ignora: `web/`, `banco/`, `parches/`,
   `herramientas/`, `docs/`, `PLAN.md`, `CLAUDE.md`) y frena si ve algo con forma de juego o de más de 50 MB; después se
   agregan **solo los archivos de Mario Kart** (la rama tiene otros cambios del dueño que no son nuestros: no se tocan)
   y se revisa `git diff --cached --stat` (nada del juego, nada grande).
2. **El repo local** (`MKW RETRO`): el primer commit, revisando antes `git status` contra `.gitignore` para que no
   entre nada del juego (`terceros/`, `extraido/`, `build/`).

**`main` del sitio juntado en la rama (sin push).** Mientras se trabajaba, `main` avanzó (casino, Momazo, PRO
DEFENDER, un buscador de juegos). Se juntó en la rama local, como hacen los otros PR del sitio ("Merge main …, sellos
regenerados"): los cambios ajenos que estaban sin commit (solo sellos `?v=` y fin de línea del build) se guardaron en
un `git stash`; los 10 archivos en conflicto eran todos del mismo tipo, **los dos lados agregaron su juego en el mismo
lugar** de una lista (el mapa de juegos, los íconos, las monedas, el salón, las reglas, las ilustraciones, las reglas
de Firebase), y se resolvieron dejando los dos (primero el de `main`, después Mario Kart). El bundle `juegos-app.js` se
tomó de `main` y se volvió a compilar con `npm run build`. Una prueba nueva de `main` (el buscador: cada juego necesita
sus "apodos" para que lo encuentren) pedía los de Mario Kart: se agregaron en `buscador.js` (el buscador se arma con la
lista ya filtrada, así que a quien no es amigo no le aparece).

**Trampa:** en el sitio, `npm run build` vuelve a sellar `?v=…` en las 35 páginas que cargan `i18n.js`; esos cambios
de solo sello no van en el commit de Mario Kart (son ruido y chocan con cualquier otro trabajo del sitio).

```bash
node banco/correr.mjs licencias
cd terceros/Paginita-Pro/colabtex && npm run build && npm run test:juegos && node tests/mkw.test.cjs
bash herramientas/subir-kit.sh
```

## 2026-10-18 · §65 Publicar en privado: el mismo Worker de BT3, el token de Firebase y la subida a R2

**Qué:** dejar todo listo para que el dueño publique Mario Kart en el sitio **solo para la lista de amigos**, igual
que BT3, sin publicar nada desde aquí (el Worker y R2 los pone él: decisión del §64). La guía de sus pasos es
`docs/publicar.md`.

**Inventario (lo que el Worker tiene que entregar).** Lo mismo que entrega hoy el servidor de pruebas
(`web/navegador/servidor.mjs`):

| Qué | Archivos | Tamaño |
|---|---|---|
| El disco extraído (`/mkw/disco/…`) | 2.043 (9 de más de 100 MB, el mayor el BRSAR de sonido) | 2,69 GB |
| Retro Rewind (`/mkw/sd/RetroRewind6/…`, `/mkw/sd/riivolution/…`) | 4.007 | 2,19 GB |
| Base del runtime (`/wc/runtime/assets/…`) | 15 | < 1 MB |
| El programa (`mkw.js`, `mkw.wasm.br`), semillas (`pipelines.bin`, `bloques.json`) e imágenes | ~40 | ~20 MB |
| `manifiesto.json` (qué archivos verá el juego) y las versiones (`X-Mkw-Version`, `X-Mkw-Build`) | 2 | pocos KB |

Al arrancar, el juego lee **182 archivos distintos** (de la semilla de bloques): eso importa por la pregunta previa
de CORS (abajo).

**1. El Worker: rutas `/mkw/` en el de BT3** (`terceros/Paginita-Pro/juegos/bt3/fuente/disco/worker.js`). El mismo
archivo, la misma variable `AMIGOS`, el mismo bucket (`DISCO`) con el prefijo `mkw/`. La llave de R2 es la dirección
sin la primera barra (`/mkw/build/mkw.js` → `mkw/build/mkw.js`), así las rutas son las del servidor de pruebas con
`/mkw` delante y la página no cambió sus direcciones: solo recibe `?privado=<Worker>/mkw`. Qué hace:
- primero lo de siempre: token de Firebase válido (401 si no) y en la lista (403 si no); recién después mira `/mkw/`;
- **pedazos (Range)**: `bytes=INICIO-FIN` o `bytes=INICIO-`, recortados al final del archivo; varios rangos, "los
  últimos N" o más de 32 MB de una vez → 416. Si R2 rechaza un rango que pasa del final, mide el archivo y recorta;
- **el programa ya comprimido**: si el navegador acepta brotli, entrega `mkw.wasm.br` tal cual (16 MB en vez de 130)
  con `Content-Encoding: br` (`encodeBody: "manual"`, para que Cloudflare no lo vuelva a tocar); con la huella vigente
  (`?v=`) va guardable para siempre (immutable), como en §54;
- **el manifiesto** con `X-Mkw-Version` y `X-Mkw-Build`, que salen de `mkw/version.json` (lo sube `subir-r2.mjs`);
- **el caché del borde** para los pedazos, con la versión en la llave (solo con dominio propio, como BT3);
- nada fuera de las carpetas de Mario Kart: ni lo de BT3 por `/mkw/`, ni subir, ni escapar con `..`;
- CORS: acepta además `Range` y `HEAD`, y deja ver `X-Mkw-*` y `Content-Range`.

Pruebas (`colabtex/tests/mkw-worker.test.cjs`, con claves y bucket falsos, bytes inventados): **6/6**. De paso se
arreglaron las 7 del Worker de BT3, que fallaban **solo en Windows** desde siempre: `import()` de una ruta `C:\…`
necesita `file://` (`pathToFileURL`). Con eso el sitio pasa de 958/966 a **972/973**: la única que queda (la del salón,
`controles.test.cjs`) también falla solo en Windows, por las barras de las rutas (`colabtex\src\…`), y no es de Mario Kart.

**2. La página pide el token** (`web/navegador/privado.mjs`, nuevo). Como el marco de BT3: le pregunta a la página de
Juegos por postMessage (`{canal:'mkw-hijo', tipo:'token'}`) y la sala (`colabtex/src/juegos/mkw.js`) contesta con
`auth.currentUser.getIdToken()`. El módulo reemplaza el `fetch` de la página: todo pedido que va al Worker lleva
`Authorization: Bearer …` (y ningún otro); al arrancar salen decenas de pedidos juntos y se pregunta **una** vez; si el
Worker dice 401 (el token dura una hora) pide uno nuevo y reintenta una vez; sin Juegos que conteste no se queda
esperando más de una vez. `mkw.js` se baja con el token y se importa desde un **blob** (`import()` no deja poner
cabeceras); el `.wasm` sigue compilándose mientras baja (`instantiateStreaming` sobre la respuesta de la red). Si el
manifiesto da 401/403, la página lo dice («Inicia sesión…» / «solo para la lista de amigos»). Banco `privado`: **18/18**.

**3. El ensayo con el Worker de verdad** (`herramientas/worker-local.mjs`, nuevo). Un arnés que carga **el mismo
worker.js que se publica** y le pone alrededor lo que en Cloudflare pone la plataforma: el bucket (los archivos
locales con las mismas llaves), las claves de Google (un par generado al arrancar) y la latencia (50 ms). Firma tokens
de prueba para `amigo-local` en `/__token-prueba` (solo existe en el arnés). `sitio-local.mjs` lo usa ahora en vez del
servidor de pruebas, y su página de Juegos le contesta el token al marco. Resultado (`medir-sitio --perfil pc`, primera
visita, mismo programa):

| | Servidor de antes (sin token) | Worker de verdad (token + lista + Range) |
|---|---|---|
| Cuadros por segundo en carrera | 58,2 | **58,8** |
| CPU por cuadro (juego + aurora) | 14,0 ms | 13,7 ms |
| Hilo principal ocupado | 77 % | 77 % |
| Hasta la carrera | 76,9 s | 75,1 s |
| Pedidos al Worker (primera visita) | 2.386 | 2.581 (+195 preguntas previas: una por archivo distinto) |

Es decir: el token y la revisión de la lista no le cuestan nada al juego. **Trampa:** la primera medición con el
Worker dio 27,5 cuadros/s con la GPU a 145 ms por cuadro (contra 14). La GPU no tiene nada que ver con de dónde salen
los archivos: era otra cosa usando la tarjeta en ese momento. Repetida en las mismas condiciones: 58,8. Antes de
creerle a una medición rara, repetirla.

**4. La subida a R2** (`herramientas/subir-r2.mjs`, nuevo; lo corre el dueño). Arma la lista exacta (llave, bytes,
SHA-256) en `build/web/publicar/lista.tsv`, el manifiesto con la forma de `servidor.mjs` y `version.json` (huellas de
todo y del programa), y sube por la **API S3 de R2** directo desde el PC: no por el Worker, así no gasta pedidos del
plan gratis ni choca con su tope de 100 MB por pedido (hay 9 archivos más grandes). Cada pedido va firmado con
Signature V4 y cada archivo con su SHA-256 (R2 rechaza el que llegue distinto); salta lo que ya está igual (se puede
cortar y repetir); `version.json` va al final. `--comprobar` revisa cada archivo en R2; `--sobrantes` muestra lo viejo
sin borrar nada. No sube el `.wasm` sin comprimir (130 MB que Chrome nunca pide) y frena si el `.br` es más viejo que
el `.wasm`. La firma da **exactamente** la del ejemplo publicado por AWS (`f0e8bd…`). Prueba con un R2 falso que revisa
firma y huella, y archivos inventados (`node herramientas/prueba-subir-r2.mjs`): **22/22**.

**5. Las partidas en la nube con la sesión de verdad (B6).** `nube.mjs` (el algoritmo: huella, subir, bajar, conflictos
con respaldo) estaba probado desde §55 con un Firebase falso, pero nadie lo llamaba. Ahora:
- **la sala del sitio** (`colabtex/src/juegos/mkw.js`) arma un almacén `{meta, bajar, subir}` con el Storage del sitio
  (`mkw/<uid>/partidas.mkwp`) y se lo pasa al marco **antes** que los de VR y récords (`window.mkwConectarNube`);
- **el marco** (`mkw.mjs`), antes de leer sus partidas, deja iguales las de este navegador y las de la cuenta
  (`nube.alEntrar`). Por eso, dentro de la sala, la lectura **espera**: hasta 4 s a que llegue la nube y, si llegó, a
  que termine; cada pedido a Firebase tiene su tope (8 s preguntar, 20 s bajar o subir), así que la espera siempre
  termina. Sin sesión o si llega tarde, se juega con lo local esa visita (y la próxima se ponen al día);
- cada guardado nuevo se sube solo unos segundos después (como mucho una vez cada 30 s) y **al esconder la pestaña** se
  sube ya lo que esperaba turno (faltaba: cerrar justo después de guardar dejaba la cuenta atrasada; lo encontró la
  prueba);
- la versión que pierde un conflicto queda en **«Copias de respaldo»** (antes quedaba solo en memoria);
- el chip de «Tu partida» dice «en tu cuenta · hh:mm» o «guardada aquí (tu cuenta no responde)»;
- **trampa — el reino**: los `Uint8Array` del marco no le sirven al Firebase de la sala (revisa `instanceof`, y cada
  ventana tiene sus propias clases). La sala copia lo que sube y el marco copia lo que baja;
- **reglas de Storage**: `firebase/storage.rules` suma `match /mkw/{uid}/partidas.mkwp` (solo su dueño, 8 MB, marcado
  con su uid, nunca HTML ni JS). Las publica el dueño (paso 5 de `docs/publicar.md`); sin ellas el juego anda igual pero
  las partidas quedan solo en el navegador.

Pruebas: sala del sitio `mkw.test.cjs` **12/12** (el almacén copia, la metadata va como texto, el orden de conexión y
el bloque de reglas). Con el juego de verdad, `node web/navegador/prueba-nube.mjs` (**9/9**): dos navegadores vacíos
con la misma cuenta y la sala falsa con un Storage falso que revisa lo mismo que las reglas. En A la licencia creada
con el teclado sube sola (21 KB, a los 14 s) marcada con el uid y copiada al reino de la sala; B la baja **antes** de
que el juego lea sus partidas (nube lista a los 0,5 s, lectura después) y arranca con esa licencia; al volver a entrar
solo se pregunta la huella; sin nube el juego espera 4,1 s y sigue. Las de antes siguen bien (partidas 6/6, banco
nube 23/23, guardado 15/15).

**6. Las semillas del programa final (B2).** Con el programa final (127,6 MB; 16,5 MB en brotli) se rehicieron las dos
semillas con 3 carreras (`guion.mjs --semilla`, copas 0, 13 y 5): **700 pipelines** (1,9 MB, antes 1,65) y **233
bloques** del disco vistos en ≥ 2 carreras (58 MB, de 466 vistos). Las viejas quedaron como `*-2026-10-17.*`.

```bash
cd terceros/Paginita-Pro/colabtex && node --test tests/mkw-worker.test.cjs tests/bt3-disco.test.cjs && node tests/mkw.test.cjs
node banco/correr.mjs privado
node herramientas/prueba-subir-r2.mjs
node herramientas/medir-sitio.mjs --perfil pc --etiqueta worker-real     # con el Worker de verdad
node herramientas/medir-sitio.mjs --perfil pc --etiqueta viejo --worker-viejo
node herramientas/subir-r2.mjs                                          # revisar (sin red)
node web/navegador/prueba-nube.mjs                                     # partidas en la nube, con el juego (9 puntos)
```

## 2026-10-18 · §66 Sin portada, la cortina y los botones que aquí no sirven

**Qué pidió el dueño** (mientras se cerraba la etapa B): «debes ocultar el menú de MK Retro Rewind». Preguntado cuál,
eligió tres cosas: **la portada de la página**, **los menús del juego mientras el piloto entra solo** y **los ajustes de
Retro Rewind** (los botones del juego que aquí no sirven).

**1. Sin portada: directo al juego.** La tarjeta de inicio (título, «Tu partida», «Jugar», la lista de modos) ya no
aparece: la página arranca el juego sola al abrirse, como en la sala del sitio. Lo que vivía ahí sigue a mano:
«Cargar mi partida», descargar y las copias en el cajón **Partida**, y **«Mi Mii»** es un botón nuevo ahí mismo. Los
modos ahora son los del propio juego (sus menús); la página solo lleva directo cuando la dirección lo pide (`?modo=…`,
lo que usa la sala). Una preferencia vieja de «Gran Premio» guardada en el navegador ya no dispara al piloto. Con
`?portada=1` la portada vuelve (para las pruebas que miran la página sin el juego: elegir pista, táctil, partidas).

**2. La cortina.** Una capa nuestra (el cielo de noche con «Mario Kart Wii + Retro Rewind», una barra que va y viene y
una línea de estado) tapa la pantalla **desde el primer instante** (está en el HTML, así nunca se ve nada antes de
tiempo) y dice en qué va: «Bajando los archivos del juego…», «Preparando el juego…», «Arrancando…». Se va con un fundido:
- **sin piloto**, cuando el juego llega a su título (sección 0x3F; medido: el arranque pasa directo de «sin sección» al
  título, a los ~6 s);
- **con piloto** (la sala del sitio: en línea o la copa sincronizada), cuando el piloto termina de recorrer los menús
  («Entrando a la sala…», «Preparando la carrera…»). En la copa vuelve mientras el piloto elige las carreras 2–4. Lo
  primero que se ve es la presentación de la pista (medido: 33 s de menús tapados en una carrera VS);
- **Esc** le quita el mando al piloto (lo de siempre) y con eso se va la cortina; si algo falla (sin WebGPU, el Worker
  dice 401/403, el programa no carga) la cortina queda con el error en rojo.
Queda por debajo de los avisos, la barra, el cajón y la lista para elegir pista (que aparece encima cuando el piloto
pregunta). `?cortina=0` la apaga (para mirar o fotografiar al piloto). La música de los menús sigue sonando debajo.

**3. Los botones de Retro Rewind que aquí no sirven.** Fotografiando los menús con `guion.mjs`: el menú principal
tiene **Single Player**, **Multiplayer** (2–4), **Retro WFC** (1 y 2 jugadores) y **License Settings**; «Un jugador»
tiene arriba a la derecha el botón **Settings** de Retro Rewind (solo se llega con el puntero del Wiimote). Se
esconden **«Retro WFC»** (en línea se juega solo desde la sala de Juegos: decisión del §64; dentro de la sala, con
`modo=enlinea`, se deja porque el piloto entra por ahí) y **«Settings»** (lo pidió el dueño).

Cómo, sin adivinar: el MAP de WiiCompiled tiene los nombres de las funciones del juego. `PushButton::__ct` dice la firma
de la clase botón (vtable 0x808B776C) y dónde va su manipulador (+0x174); `PushButton::SetPlayerBitfield` dice qué
escribe para que nadie pueda elegir un botón (+0x244 y +0x1E4 en 0). Explorando la memoria con el juego andando (cada
candidato escondido y fotografiado):

| Qué | Dónde |
|---|---|
| byte «escondido» de cualquier control | +0x80 (1 = no se dibuja; se comprobó escondiendo «License Settings») |
| botones de una página | apuntan en +0x234 al administrador de mandos de su página (página +0x658); su número en +0x240 |
| menú principal (página 0x5A) | recuadros de la página en +0x6C4 (Single), +0x838 (Multi), **+0x9AC (Retro WFC)**; botones de video (clase 0x808D35A8) números 0–3 y **4–5 (Retro WFC 1 y 2)**; License Settings = 7; Back = −100 |
| «Un jugador» (página 0x69) | modos números 0–4 (clase 0x808D3530); **Settings = PushButton número 5** (en el montón, lejos de la página) |

Para que lo escondido **ni alcance a dibujarse**, el juego avisa cada pantalla que se activa: `web/juego/paginas_nativo.cpp`
reemplaza `Page::Activate` (0x80601AEC, igual que la semilla de §56: la traducida pasa a `_traducida` y la nuestra la
llama y después avisa a `Module.mkwAlActivarPagina`). `web/navegador/ocultar.mjs` busca los botones de esa página
(±256 KB alrededor de ella, por su administrador) y esconde según sus reglas, **revisando antes la forma** (clase,
número, administrador): si otra versión de Retro Rewind cambiara algo, no se escribe nada. El cursor ya no puede bajar
a «Retro WFC»: abajo + A desde «Single Player» entra a «Single Player». `?ocultar=0` deja el juego tal cual.

Pruebas:
- banco `ocultar` (sin el juego, memoria inventada con la forma de los menús): **11/11** — solo lo pedido, nada en la
  sala en línea, un botón igual de otra página no se toca, con otras clases no se escribe nada;
- `node web/navegador/prueba-menus.mjs` (con el juego): **8/8** — la cortina tapó la carga y se fue en el título; el
  recuadro y los 2 botones escondidos y sin poder elegirse; los otros 6 a la vista; abajo + A no entra en línea;
  «Settings» escondido; con `?ocultar=0` el recuadro se ve;
- las de la página siguen bien con la cortina: navegador **20/20**, piloto **9/9**, partidas **6/6**, elegir pista
  **23/23**, táctil **16/16** (la táctil simula «juego andando»: ahora además saca la cortina).

```bash
node banco/correr.mjs ocultar
node web/navegador/prueba-menus.mjs
node web/navegador/prueba-nube.mjs
```

## 2026-10-18 · §67 El menú de inicio «JloKart Wii», solo para los amigos, y el ensayo general (B5)

**Qué pidió el dueño.** Tres mensajes seguidos: «Usa este como el starting menu» (con su imagen: «JloKart Wii», un
piloto real con camiseta amarilla en un kart azul con el número 9, una copa en la mano, y a la derecha los botones
Single Player, Multiplayer, Championship y Options, abajo «PRESS START»), «pero quita el championship» y «necesito que
ese starting menu de JLo kart solo se vea para personas registradas en el cloudflare bajo un clave, como se hace en el
bt3». Ese "registradas bajo clave" es exactamente lo de BT3: el Worker de Cloudflare revisa el **token de Firebase** de
quien pide (la credencial con foto y vencimiento de §65) y que esté en la lista **`AMIGOS`**.

### 1. La imagen: sin los botones pintados, y privada

Los botones de la imagen están **pintados**: si se dejaran así, el resaltado (el botón elegido, más brillante y con la
flecha ▶) quedaría siempre en «Single Player» aunque se eligiera otro, y «Championship» no se puede quitar de una
pintura. Por eso `herramientas/preparar-inicio.py` (Python con OpenCV) **borra los 4 botones y la flecha** y rellena el
hueco con el fondo, y la página dibuja **sus propios 3 botones** encima:

1. una **máscara** con la forma de cada botón (una píldora: rectángulo con puntas redondas), un poco agrandada para
   llevarse también el brillo del borde, más el triángulo de la flecha;
2. el relleno: **75 % por filas** (cada fila, una recta entre el color de su borde izquierdo y el del derecho: continúa
   las rayas de velocidad del fondo) **+ 25 % pull-push** (el promedio de los vecinos, de cerca a lejos: suaviza los
   saltos de color entre filas), con un desenfoque solo vertical;
3. un **grano** de la misma intensidad que el de la imagen (medido fuera del hueco), para que no se vea "plástico";
4. sale en **WebP de 264 KB** (1448 × 1086) a `build/web/navegador/imagenes/inicio/jlokart.webp`.

**La imagen muestra a una persona real: no va a git ni a GitHub Pages.** `build/` está en `.gitignore`;
`subir-r2.mjs` ya sube todo `build/…/imagenes` como `mkw/build/imagenes/…`, y el Worker ya protege `/mkw/build/` con el
token y la lista (las mismas reglas que el programa del juego). No hubo que tocar el Worker.

```bash
python -I herramientas/preparar-inicio.py "C:\Users\zilon\Downloads\Jlo Kart Wii Victory Splash.png" --prueba
```

### 2. Quién la ve: lo mismo que el disco de BT3

- **La página** (`web/navegador/mkw.mjs` + `inicio.mjs`) pide la imagen al Worker con `fetch`; `privado.mjs` le pone el
  token a todo pedido que va al Worker (§65). Llega como bytes (un *blob*) y se muestra con una dirección local
  `blob:`. Si el Worker contesta **401** (sin sesión), **403** (no está en `AMIGOS`) o **404** (todavía no subida), el
  menú **no aparece** y la página sigue como antes. Nadie fuera de la lista ve la imagen: ni siquiera está en el sitio.
- **El sitio** (`terceros/Paginita-Pro/colabtex`): nueva entrada **«Mario Kart Wii · un jugador»** (`#solo/mkw`, en
  `salon-datos.js`), igual que «Tenkaichi 3 · un jugador»: `crearMkwSolo` (en `src/juegos/mkw.js`) primero le pregunta
  al Worker si la persona es amiga (`revisaBt3`, `/soy` con el token); si no, «Este juego es privado»; si todavía no
  hay dirección del Worker (`privado.json` vacío), «todavía no está publicado»; si sí, abre la página del juego a
  pantalla completa en un marco (`?senal=padre&privado=<Worker>`), le contesta el token cuando lo pide, le pasa sus
  partidas y récords de la cuenta, y atiende sus avisos: `volver` («← Juegos») y `salas` (Multiplayer → Online: abre las
  salas de Mario Kart). La entrada, como todo lo de Mario Kart, no aparece en las listas para quien no es amigo.

### 3. El menú

- **Cuándo sale:** al abrir el juego **sin un modo ya decidido** (sin `?modo=` de una sala). La sala del sitio (en
  línea o la copa con CPU) sigue entrando sola, tapada por la cortina.
- **Mientras está**, el juego carga y arranca **debajo** (así, al elegir, ya está listo o casi), pero no recibe nada de
  la persona: `controles.silenciar(true)`.
- **Los botones:** 3 de verdad (Single Player, Multiplayer, Options), con la letra *Lilita One*, en el lugar de los 3
  primeros pintados, sobre un **panel de vidrio esmerilado** que hace que la zona rellenada se vea como parte del menú.
  El elegido brilla, late y lleva la flecha ▶; abajo, una línea dice qué hace. «PRESS START» late y tocarlo acepta.
- **Single Player** → el menú se va, la cortina tapa al tiro («Entrando a Single Player…») y el piloto lleva el juego
  hasta su menú **«Un jugador»** (página 0x69: Grand Prix, Contrarreloj, VS, Batalla) y ahí se detiene
  (`piloto.hasta`, nuevo en `menus.mjs`): desde ahí se juega con los menús del juego.
- **Multiplayer** → «Local» (este PC, 2 a 4 mandos: el piloto deja el juego en su menú principal con el cursor movido a
  la derecha, sobre «2 Players»), «Online» (solo dentro del sitio: le avisa a Juegos que abra las salas) y «Back».
- **Options** → el cajón de la página en «Controles». Mientras el cajón (o un diálogo) está encima, el menú no se mueve.
- **Volver:** si la persona aprieta B hasta el título del juego, vuelve nuestro menú (el gancho de `Page::Activate` de
  §66 avisa que se activó la página del título, 0x57).
- **Cómo se maneja:** teclado (flechas o W/S, Enter/Espacio/K, Esc/Retroceso/J), cualquier mando (A o Start acepta, B
  vuelve, cruz o stick mueven, con auto-repetición; se miran los **flancos**: un botón que ya estaba apretado al abrir
  no elige nada), mouse y toque. En un **teléfono parado** la imagen va arriba y los 3 botones grandes abajo.
- **Las pruebas automáticas no lo ven** (`navigator.webdriver`), salvo con `?inicio=1`; `?inicio=0` lo apaga.

### 4. Pruebas

- banco **`inicio`** (sin el juego, con una imagen **falsa** dibujada en un canvas): **14/14**. Con 401/403/404 o sin red
  no aparece; con 200 sí, pedida una sola vez; 3 botones sin «Championship»; teclas (y lo que usa no le llega al juego);
  Multiplayer, Esc y Back; Options; quieto con el cajón; mando (cruz con repetición, stick, A, B); clic, mouse y «PRESS
  START»; un botón ya apretado no cuenta; «Online» solo en el sitio; acostado 1280×720 y teléfono 412×915.
- **`node web/navegador/prueba-inicio.mjs`** (con el juego): **14/14**. Aparece con la imagen (200); silenciado; teclado
  y submenú; Options y el cajón; el juego llega a su título debajo; Single Player → cortina al tiro → menú «Un jugador»
  (0x69) sin cortina; B, B → vuelve el menú; Local → menú principal (0x5a); sin `?inicio=1` no aparece; **en el sitio con
  el Worker de verdad y un token de amigo, aparece**, y Multiplayer trae «Online», que avisa a Juegos; **la página
  suelta, sin sesión: el Worker contesta 401 y el menú no aparece**.
- sitio: `mkw.test.cjs` **13/13** (la prueba nueva arma `crearMkwSolo` con un DOM de mentira: privado, sin publicar, el
  marco con el oyente puesto antes de cargarlo, la dirección sin modo, los avisos solo de su marco y su origen, el token
  fresco, la ruta, la vista y la entrada escondida); `test:juegos` **974/975** (la que falla es la de Worms con rutas de
  Windows, de antes y ajena).
- las demás (que el menú no debía cambiar): ver el registro del PLAN de este día.

### 5. El ensayo general (B5)

El programa **final** (16 MB comprimido) por el **Worker de verdad** (`sitio-local.mjs`: el sitio como GitHub Pages y el
Worker local con un token de amigo y 50 ms de latencia), dos visitas seguidas con el mismo Chrome:

| | 1.ª visita | 2.ª visita | 1.ª visita a 200 Mbit/s |
|---|---|---|---|
| Primer cuadro | 4,0 s | 2,2 s | 4,7 s |
| Carrera (cuadros por segundo) | 58,9 | **60,0** | 58,6 |
| Procesador por cuadro (promedio / p95) | 9,8 / 12,1 ms | 8,8 / 10,2 ms | 9,7 / 12,8 ms |
| Imágenes parejas en la pantalla de 240 Hz | 81 % | **99,5 %** | 84 % |
| Bajado del Worker | 217 MB (2.623 pedidos) | **6 MB** (43) | 210 MB |

En la 1.ª visita los tirones del arranque de la carrera son del **disco que todavía está llegando** (180–380 ms de
espera de lectura en los 3 primeros); en la 2.ª ya está en la caché de la página y la carrera va pareja. Resultados en
`build/web/datos/medir-sitio/b5-final-pc.json` y `b5-final-red200-pc.json`.

### Trampas

- **El relleno salía oscuro:** el pull-push se cortaba en 8 × 11 píxeles con el hueco todavía sin cerrar (es grande: ~330
  × 320); esas celdas vacías quedaban negras y oscurecían todo. Ahora achica hasta que no queda hueco.
- **Relleno parejo = parche:** el pull-push solo dejaba una mancha beige lisa; el relleno por filas continúa las rayas.
- **El teléfono parado:** `translate` y `container-type` del lienzo convierten al lienzo en la referencia de sus hijos
  `fixed`; en el teléfono se le quitan los dos.
- **3 repeticiones dan la vuelta:** con 3 botones, mantener la cruz 0,7 s vuelve al mismo; la prueba cuenta los cambios.
- **En Windows `kill()` no cierra a los hijos:** `prueba-inicio` cierra el árbol entero (`taskkill /T`), si no el
  "Worker" de `sitio-local` queda vivo ocupando su puerto.

```bash
node banco/correr.mjs inicio
node web/navegador/prueba-inicio.mjs
node herramientas/medir-sitio.mjs --perfil pc --etiqueta b5-final --visitas 2
```

## 2026-10-18 · §68 La pantalla negra al caer del mapa: es la transición del juego

**Qué vio el dueño.** "Hay una leve pantalla en negro cuando el personaje cae del mapa y lo rescatan." La pregunta era si
eso lo hace Mario Kart Wii a propósito o si es un error de nuestro port (por ejemplo, el juego trabado un instante
mientras carga algo, o el renderizador dibujando mal un efecto).

**Cómo se midió.** Un diagnóstico nuevo, `web/navegador/prueba-caida.mjs`, que hace la caída a propósito y graba lo que
de verdad se ve:
1. abre el juego en Contrarreloj (sin fantasma ni CPU) en **SNES Rainbow Road** (copa 4, pista 4: bordes sin baranda) y
   espera el fin de la cuenta regresiva;
2. maneja solo con el teclado (acelerar y doblar a la izquierda 1,8 s, después derecho 5 s, y otra vez): en 22 s el kart
   se cae 3 veces;
3. mientras, graba el **screencast** de Chrome (cada imagen que llega a la pantalla, ~60 por segundo, con su hora) y lee
   cada 25 ms el **contador de cuadros del juego** (cuántos cuadros lleva calculados);
4. mide el **brillo** de cada imagen y busca los tramos oscuros.

La clave para distinguir los dos casos: si el juego se trabara, el contador se quedaría quieto (y en pantalla quedaría
la última imagen, no negro). Si el contador sigue subiendo 60 por segundo mientras la pantalla está negra, el negro lo
está **dibujando el juego**, cuadro a cuadro.

Probé primero en Wii Rainbow Road, pero ahí el kart se quedó raspando una baranda (esa parte tiene) y no se cayó nunca:
ningún tramo oscuro. Por eso la prueba usa la pista de Super Nintendo, que no tiene barandas.

**Resultado** (`node web/navegador/prueba-caida.mjs`; entonces con 4 puntos, **4 bien, 0 mal**):

| Rescate | Tramo oscuro | Negro del todo | Se cierra en | Cuadros del juego durante el negro |
|---|---|---|---|---|
| 1 | 1983 ms | 90 imágenes (~1,5 s) | 382 ms | 119 (60,0 por segundo) |
| 2 | 1967 ms | 90 imágenes | 483 ms | 119 (60,5 por segundo) |
| 3 | 1999 ms | 90 imágenes | 416 ms | 121 (60,5 por segundo) |

Las fotos (en `build/web/datos/caida/`) muestran el efecto: **rayas horizontales negras que se ensanchan** hasta tapar
todo (una persiana que se cierra, ~0,4 s), ~1,5 s en negro (también tapa el reloj y el mapa), y las rayas que se abren
con el kart ya colgando de Lakitu sobre la pista. Es la **transición** con la que Mario Kart Wii esconde el salto del
kart de vuelta a la pista.

**Qué significa.**
- **No es un tirón ni un error del port.** El juego siguió calculando 60 cuadros por segundo todo el rato, y cada
  rescate dura lo mismo (±16 ms, un cuadro) porque lo cuenta el juego en cuadros, no el reloj de la PC. Como nuestros
  cuadros van a la velocidad de la Wii (60 por segundo), dura lo mismo que en la consola.
- **La forma (rayas, sin degradado) y que llegue a negro del todo** son del juego: un error de dibujo daría un corte de
  golpe, rayas sueltas o colores raros; aquí la cortina se cierra y se abre pareja y simétrica, y la imagen vuelve
  perfecta.
- **Se puede acortar o sacar**, porque el dueño permite modificar el juego: habría que encontrar en el código del
  rescate (`Lakitu::Player::UpdateRespawn`, `RaceCamera::OnRespawn`) el contador de cuadros del negro y achicarlo. Pero
  el juego original es así, y Retro Rewind también la deja. **El dueño decidió dejarla como en el juego original**
  (2026-10-18): no se toca.

**Y "solo una porción de la pantalla".** Después el dueño contó que en su prueba la cortina tapaba **una parte** de la
pantalla, no toda, y que debía ser "por el stretch". Tenía razón en sospechar del estirado:
- WiiCompiled tiene un **aspecto dinámico** (`runtime/src/dynamic_aspect.cpp`): con `widescreen = true` le cambia al
  juego el ancho de sus "pantallas" (los registros de `EGG::Screen`) para que la escena 3D llene la ventana con la forma
  que tenga (política `AURORA_VIEWPORT_STRETCH`). En una ventana MÁS ANCHA que 16:9 (por ejemplo el programa de
  WiiCompiled en Windows, con la ventana estirada a lo ancho) el juego dibuja una escena más ancha de lo que fue hecho:
  lo 3D se ensancha, pero un efecto 2D como esta cortina, pensado para 16:9 como mucho, tapa solo el medio. Es como
  proyectar una película en una pantalla más ancha que la película: el telón del cine no alcanza a cubrir los costados.
- **En nuestra página eso no pasa**: el programa web abre su "ventana" fija en **854×480** (16:9; `main.cpp`, `windowWidth
  = 854` con pantalla ancha), así que el juego siempre dibuja una imagen 16:9 y la página la agranda **sin deformarla**
  (`object-fit: contain`: si la ventana del navegador tiene otra forma, quedan barras negras de la página a los lados o
  arriba y abajo, nunca un estirado).
- **Corregido en §79:** esto vale solo hasta el primer cambio de tamaño. SDL3 agranda el canvas a su recuadro con cada
  `resize` (en el sitio, el marco cambia después de cargar) y desde ahí el juego sí se estiraba. Ahora la página pide
  `force_16_9` y la imagen es 16:9 siempre.

Lo medí con un 5.º punto en la prueba: el brillo de los **bordes** de la imagen del juego (8 % de su ancho a cada lado)
en el corazón del negro (sin los primeros y últimos 100 ms, donde todavía cruzan las últimas rayas finas):

| Ventana del navegador | Imagen del juego en pantalla | Bordes en el negro | Resultado |
|---|---|---|---|
| 960×792 (casi cuadrada) | 960×540 (barras arriba y abajo) | 0,3 y 0,5 de 255 | **5 bien, 0 mal** |
| 1800×760 (muy ancha) | 1352×760 (barras a los lados) | 0,0 y 0,5 de 255 | **5 bien, 0 mal** |

Una trampa del camino: la primera versión del 5.º punto miraba TODAS las imágenes negras del centro y daba bordes de 4 a
6,5 en la ventana ancha. No era un pedazo sin tapar: eran las 3 primeras y las 5 últimas imágenes del negro, cuando
quedan las últimas rayas finas (cruzan de lado a lado, así que también tiñen los bordes). En el medio del negro, la foto
entera da 0,0 columna por columna.

**La prueba queda en el banco** (5 puntos ✓/✗): que hubo rescate y la imagen volvió; que durante el negro el juego siguió
a 60 cuadros por segundo (si algún día se traba justo ahí, por ejemplo cargando el modelo de Lakitu, esto lo detecta);
que se cierra de a poco y no de golpe; que cada rescate dura lo mismo; y que la cortina tapa toda la imagen, bordes
incluidos, con la ventana que sea (`--ancho`/`--alto`).

```bash
node web/navegador/prueba-caida.mjs                       # SNES Rainbow Road, 22 s, ~3 caídas
node web/navegador/prueba-caida.mjs --ancho 1800 --alto 760   # una ventana muy ancha: la cortina tapa toda la imagen igual
node web/navegador/prueba-caida.mjs --copa 0 --fila 2 --plan "K+D:1500 K:4000"   # otra pista y otro manejo
```

## 2026-10-18 · §69 El jugar.bat: la página de Juegos en esta PC, solo con Mario Kart, de punta a punta

**Qué pidió el dueño.** «mejor un .bat que abra el menu de la pagina, para efectos practicos solo muestrame de juegos el
MKW y el MKW online para probar la experiencia de usuario de principio a fin y todas las features y modos que te pedi»,
y «piensa tambien si te combiene hacerlo como artifact mejor o no, en el bt3 testeamos el online con la sesion de
artifact abierto en 3 pestanas distintas de chrome». Reemplaza los pedidos anteriores (un jugar.bat «como se verá en la
página» y otro .bat para la playlist y la sala).

### 1. ¿Artifact o la página en esta PC? La página en esta PC

Se pensó y **no conviene un artifact**, por tres razones:

1. **El juego no puede ir en un artifact.** Es el programa de Nintendo traducido (más los archivos del disco y de
   Retro Rewind): por regla nunca se publica, vive solo en R2 detrás del Worker de amigos. Un artifact es una página
   que se sube a claude.ai.
2. **Un artifact no puede hablar con esta PC.** Corre dentro de claude.ai con reglas de seguridad (su política de
   contenido y la *Private Network Access* de Chrome) que no le dejan pedir nada a 127.0.0.1: ni al juego, ni a los
   emuladores, ni al Worker local.
3. **No sería el sitio.** Lo que hay que probar es justamente **la página de Juegos de verdad**: el catálogo, iniciar
   sesión, la ficha de la sala, el vestíbulo, el marco del juego, las reglas de Firebase. En BT3 el artifact servía
   porque se probaba la sala en sí; aquí la sala ya está probada en el banco y lo que falta es el camino completo.

Lo bueno del método de BT3 (**varias pestañas = varias personas**) se conserva: el .bat abre **1, 2 o 3 ventanas de
Chrome, cada una con su propio perfil**, o sea, cada una es "otro PC" con su propia cuenta.

### 2. Cómo funciona (`jugar.bat` → `herramientas/experiencia.mjs`)

Doble clic en **`jugar.bat`**: pregunta cuántas ventanas (1 = jugar uno; 2 o 3 = probar la sala en línea; si no se
contesta en 15 s abre 1) y corre `node herramientas/experiencia.mjs --ventanas N`, que levanta, todo en 127.0.0.1:

1. **Firebase de mentira**: los emuladores oficiales (cuentas, base y Storage) con las reglas del sitio tal cual
   (`firebase/database.rules.json` y `storage.rules`, copiadas a `build/emuladores/` al arrancar: firebase-tools no
   acepta reglas fuera de su carpeta). Lo jugado queda en `build/emuladores/datos` al cerrar con Ctrl+C.
2. **Las cuentas de mentira**: Piloto Uno, Dos y Tres (en la lista de amigos) e Intruso (no está).
3. **El sitio como GitHub Pages** (`sitio-local.mjs --emuladores --solo mkw --amigos …`) en
   http://127.0.0.1:8150/juegos.html, con el **Worker de verdad** en 8151 (`worker-local.mjs --emulador`, que
   re-firma los tokens del emulador y tiene como `AMIGOS` los correos de los tres pilotos).
4. **Chrome**: una ventana por jugador (`build/perfiles/jugadorN`), lado a lado, repartiendo el ancho de la pantalla.

Lo que se le agregó al sitio para esto **solo existe en esta PC**:

- `colabtex/src/firebase.js`: si la página está en 127.0.0.1/localhost **y** el servidor puso
  `window.__FIREBASE_EMU`, se conecta a los emuladores, sin App Check ni Analytics (nada sale de la PC).
- `colabtex/src/juegos-main.js`: con `window.__JG_SOLO` (también solo en 127.0.0.1) el catálogo y las novedades
  muestran solo esos juegos.
- Una prueba nueva del sitio (`mkw.test.cjs`, 14/14) toma esas dos condiciones del código y las evalúa con otras
  direcciones: en `cstappung.github.io`, en `localhost.malo.com` o en una IP de la red de la casa no hacen nada,
  aunque alguien ponga los objetos.

Otras opciones: `jugar.bat limpiar` (borra cuentas, salas, partidas y VR de mentira) y `jugar.bat suelto` (el juego
solo, sin la página: lo que hacía el jugar.bat antes, en http://127.0.0.1:8140/).

### 3. Qué se puede probar

En cada ventana: «Iniciar sesión» y elegir una cuenta distinta en la ventanita del emulador. Después:

- **«Mario Kart Wii · un jugador»** → el menú de inicio JloKart (§67): Single Player (Grand Prix, Contrarreloj, VS,
  Batalla), Multiplayer → Local (2 a 4 mandos en este PC) u Online (abre la sala), Options (controles, partida, Mi
  Mii). Las partidas se guardan en la cuenta (Storage del emulador) y los récords en la base.
- **La sala «Mario Kart Wii»**: en una ventana «Abrir sala e invitar»; en las otras, entrar (con «Salas abiertas» o
  el enlace). Con CPU y hasta 4 pilotos: la copa sincronizada (§61); sin CPU: VS en línea, el que mueve el VR. El
  anfitrión aprieta «¡A correr!».
- **Intruso**: a él no le aparece nada; con el enlace de la sala ve «Esta sala es privada».

### 4. Lo que encontró el ensayo: la página no arrancaba en el sitio

La primera vuelta de la prueba se quedó en «Cargando el juego…» dentro de «un jugador». La causa: `mkw.mjs` importaba
sus verificaciones ✓/✗ con la **ruta relativa** `./banco/comun.js`. En el servidor del juego la página está en la raíz
(`/`), y `/banco/` existe; en el sitio la página queda en `juegos/mkw/web/navegador/` y el banco en `juegos/mkw/banco/`,
así que el navegador pedía `juegos/mkw/web/navegador/banco/comun.js`, que **no existe**: un módulo que falta tumba a
toda la página, y el juego nunca arrancaba (ni en «un jugador» ni en la sala del sitio).

¿Por qué no lo vio antes el ensayo general (B5, §67)? Porque `sitio-local.mjs` servía la página **también** en
`/juegos/mkw/` (un atajo), y desde ahí `./banco/` sí calzaba con `/juegos/mkw/banco/`. La sala y «un jugador» del sitio
de verdad abren la otra dirección.

**Arreglo:** las verificaciones pasan a `web/navegador/verificaciones.mjs`, al lado de la página (la carpeta de la página
ya no depende de nada de afuera), y `sitio-local.mjs` ya **no tiene el atajo**: sirve la página solo donde va a quedar en
el sitio (su marco de `?mkw=1`, `medir-sitio.mjs` y `prueba-inicio.mjs` usan esa dirección). Sin esta prueba, el
problema habría aparecido recién con el sitio publicado.

### 5. La prueba (`node herramientas/prueba-experiencia.mjs`)

Arranca el mismo ensayo sin ventanas, en otros puertos (8154/8155) y otra carpeta (`build/emuladores-prueba`, siempre
desde cero: nunca toca lo jugado), y lo recorre como una persona, con tres "PC":

| # | Qué se comprueba | Resultado |
|---|---|---|
| 1 | Invitado: el catálogo no muestra nada (Mario Kart es solo para amigos; lo demás lo esconde el filtro local) | ✓ 0 tarjetas |
| 2 | Piloto Uno inicia sesión con la ventanita del emulador («Google» de mentira) | ✓ |
| 3 | El catálogo muestra **solo** Mario Kart: «Mario Kart Wii · un jugador» y la sala «Mario Kart Wii» | ✓ 2 tarjetas |
| 4 | Tarjeta → ficha → ▶ Practicar: el juego en su marco (`#solo/mkw`) y el menú JloKart con la imagen privada | ✓ imagen 200, 3 botones |
| 5 | Single Player (con el mouse) → el piloto deja el juego en su menú «Un jugador» | ✓ página 0x69 |
| 6 | Las partidas quedaron conectadas con la cuenta (Storage del emulador, con sus reglas) | ✓ «subida automática», 1 subida |
| 7 | B hasta el título → vuelve el menú; Multiplayer → **Online** → Juegos abre la ficha de la sala | ✓ |
| 8 | Piloto Uno abre la sala (12 pilotos, CPU normal): vestíbulo y «¡A correr!» | ✓ |
| 9 | Piloto Dos (otro PC) entra con el enlace: «2 de 12» en las dos ventanas | ✓ |
| 10 | Intruso: 0 tarjetas, «Este juego es privado», «Esta sala es privada» y ningún marco del juego | ✓ |
| 11 | «¡A correr!»: el juego se abre en la sala de los dos (modo copa) | ✓ |
| 12 | Los dos llegan solos a la carrera de la copa | ✓ a los 49 y 66 s |
| 13 | La misma carrera en los dos: las huellas coinciden y ninguno se separó | ✓ 3 huellas iguales, cuadro 451/450 |

**13 bien, 0 mal** (unos 6 minutos; `--rapida` hace los 10 primeros en ~2). Fotos en `build/web/datos/experiencia/`: el
catálogo del amigo, el menú JloKart dentro del sitio (con su botón «← Juegos»), la ficha, el vestíbulo y la carrera en
la sala.

Lo que esta prueba demuestra que las otras no: **el camino entero por el sitio de verdad**, con las reglas de Firebase
de verdad (crear y entrar a la sala, el buzón de la red de la carrera, las partidas en Storage) y el Worker de verdad
(la lista de amigos decide qué ve cada cuenta).

### Trampas

- **«Ver opciones y abrir sala» no es el botón:** es el texto de la tarjeta del catálogo. La prueba buscaba "abrir
  sala" y apretaba la tarjeta otra vez (que cierra la ficha): el botón de la ficha es `.jg-hoja-ya[data-f=sala]`.
- **La dirección de la página en el sitio es `juegos/mkw/web/navegador/index.html`**, no `juegos/mkw/index.html`.
- **Los acentos del .bat:** el archivo está en UTF-8 y la ventana de comandos lo lee con su "página de códigos" (la
  tabla que traduce bytes a letras). `chcp 65001` la cambia a UTF-8 para que «¿Cuántas?» se vea bien, pero tiene que
  ir **en la segunda línea**, antes de cualquier letra con acento: puesto más abajo, cmd perdía la cuenta de dónde iba
  en el archivo y seguía en la mitad de un comentario («jugar.bat limpiar»), que intentaba correr como comando.
- **Probarlo desde aquí** necesita la ruta completa del .bat: esta sesión de trabajo tiene la variable
  `NoDefaultCurrentDirectoryInExePath`, que le prohíbe a cmd buscar programas en la carpeta actual. Al hacer doble
  clic en el Explorador eso no existe. Se probó así: preguntó, abrió 1 ventana sola a los 15 s, levantó todo («Listo»)
  y abrió Chrome con su perfil `build/perfiles/jugador1`.
- **firebase-tools no acepta reglas fuera de su carpeta:** se copian a `build/emuladores/` en cada arranque (así
  siempre son las del sitio).
- **Ctrl+C en el .bat:** Windows avisa a todos los programas de la ventana; los emuladores guardan solos y el arnés los
  espera hasta 30 s antes de terminar. Si se cierra la ventana con la X, lo de esa sesión puede no guardarse.
- **La primera vez** firebase-tools baja los emuladores (unos 85 MB, a `%USERPROFILE%\.cache\firebase`).
- **Puertos:** 8150/8151 (sitio y Worker) y 9099, 9000, 9199, 4400, 4500 (emuladores). Si otro jugar.bat quedó
  abierto, el arnés lo dice y no arranca a medias.

```bash
jugar.bat
node herramientas/experiencia.mjs --ventanas 2
node herramientas/prueba-experiencia.mjs
node herramientas/prueba-experiencia.mjs --rapida
```

## 2026-10-18 · §70 El retraso que se adapta a la red (C3), la planilla de todas las pruebas (F1) y el cuelgue que no volvió (C4)

**En resumen:** en la carrera sincronizada (§61) cada consola usa los botones de las demás con 3 cuadros de retraso
(50 ms). Si la red tarda más que eso, la carrera va en cámara lenta. Ahora, antes de cada carrera, se mide la red y
se elige el retraso justo: en esta PC sigue en 3; con un jugador a 70 ms sube solo a 6 y la carrera va a 60 cuadros
por segundo. Además: un programa que corre todas las pruebas y entrega la planilla, y el cuelgue al empezar la
carrera (C4), que no volvió a salir.

### 1. El problema: la cámara lenta con una red lenta

Recordatorio de §61: lo que aprieta cada jugador en el cuadro *c* vale para el cuadro *c + 3*. Esos 3 cuadros
(50 ms) son el plazo que tienen sus botones para llegar a las demás consolas. El juego no puede calcular el cuadro
siguiente sin los botones de todos. Si un paquete tarda 70 ms en llegar, cada consola **espera** unos 20 ms en cada
cuadro: la carrera avanza al ritmo del paquete más lento.

Para medirlo sin salir de esta PC se hizo una **red mala de mentira** (`?redMala=70,10,5` en la dirección de la
página, `malla.mjs`, solo para pruebas). Demora todo lo que llega 70 ± 10 ms y bota el 5 % de lo que va por el canal
rápido ("udp"). Con el retraso fijo de siempre, la misma carrera esperó **9,4 y 11,2 ms por cuadro** (de 16,7
disponibles): unos 40 cuadros por segundo en vez de 60. Eso es la cámara lenta.

### 2. La solución: medir la red y elegir el retraso antes de cada carrera

| Pieza | Qué hace |
|---|---|
| **Ping cada 0,5 s** (mensajes tipo 7 y 8) | Cada consola le manda a cada jugador un ping con la hora y su número; el otro lo devuelve tal cual. Hora de llegada − hora del ping = ida y vuelta. |
| **El cálculo** | De las últimas 16 idas y vueltas (8 s): la más rápida es el piso; las que pasan del piso + 100 ms son tirones (no cuentan); de las demás, el percentil 90. La ida es la mitad. Si se perdió alguna respuesta en esos 8 s: la mediana + un cuadro, si eso es más (un paquete perdido llega repetido en el siguiente, 16,7 ms después). + 6 ms de margen. Se pasa a cuadros redondeando hacia arriba, entre 3 y 8. |
| **El decisor** (mensaje tipo 9) | Solo el primer humano de la sala que sigue jugando elige el número, una vez por carrera, **cuando él empieza la carrera**. Lo manda por el canal confiable (llega siempre y en orden). |
| **El reenvío** | Quien recibe el anuncio se lo reenvía a todos, por si a alguno no le llegó directo. Si llegan dos números distintos para la misma carrera, gana el primero y se anota como "conflicto" (no pasó nunca en las pruebas). |
| **La espera del anuncio** | Los demás, al llegar al primer cuadro de la carrera, esperan el anuncio. Esa espera cuenta como "llegada", igual que esperar a que el otro termine de cargar la pista. Si el decisor nunca vino, a los 4 s todos usan 3. |
| **`?retraso=fijo`** | El camino viejo (siempre 3), para comparar. |

**¿Por qué el mismo número en todas?** Los primeros cuadros de cada carrera son "sin botones" hasta el retraso. Si una
consola usara 3 y otra 6, en el cuadro 4 una ya tendría botones y la otra no: la carrera se desincronizaría. Por eso
decide uno solo, una vez, y el número no cambia durante la carrera.

**¿Por qué no se cambia a mitad de carrera?** Cambiarlo sin desincronizar exige que todas las consolas lo cambien en el
mismo cuadro exacto, con los cuadros intermedios bien definidos. Se puede, pero es complicado, y entre carrera y
carrera la red casi nunca cambia tanto.

### 3. El primer intento: daba 8 en esta misma PC

La primera versión suavizaba la ida y vuelta como lo hace TCP (un promedio que se mueve poco a poco, más una
"variación"). El decisor anunciaba apenas tenía 4 medidas. Con el juego dio **8 cuadros (133 ms) con la red de esta
misma PC**, donde la ida y vuelta es de 1 ms. ¿Por qué?

- Las primeras medidas se toman **mientras las pestañas cargan el juego**: compilar el `.wasm` o leer el disco traba
  la pestaña 1 o 2 segundos. En ese rato no contesta nada, y al destrabarse contesta todos los pings juntos. Esas
  idas y vueltas salen de 400 a 1400 ms, sin que la red tenga la culpa.
- El anuncio se hacía justo en ese momento y quedaba fijo para toda la carrera.

Se arregló en dos partes:

1. **Se anuncia al empezar la carrera**, no durante la carga. Para entonces hay 8 s de medidas, tomadas en los
   menús.
2. **No se promedia: los tirones se descartan.** El piso (la medida más rápida) dice cuánto tarda la red cuando
   nadie se traba. Lo que pasa de 100 ms sobre el piso es una pestaña ocupada, no la red.

Hubo dos ajustes más en el banco:

- Con el cuartil 75 en vez del percentil 90, la red lenta del banco (que bota 1 de cada 7 paquetes) quedaba en 5 y
  esperaba 2,2 ms por cuadro.
- Sumar a la vez "percentil 90" y "un cuadro por pérdida" daba 7: un cuadro de más. Por eso se toma el mayor de los
  dos.

### 4. Pruebas

**Banco** (`node banco/correr.mjs lockstep`, sin el juego, consolas falsas): **32/32 tres veces seguidas**. Los
escenarios nuevos:

| Escenario | Resultado |
|---|---|
| Red rápida normal | Las tres consolas usan 3 |
| Red lenta: 62–78 ms de ida, 1 de 7 paquetes perdido | Adaptado: **6** cuadros, espera 0,4–0,6 ms por cuadro. Fijo: 3 cuadros, **10,1–10,6 ms** por cuadro |
| A Carla no le llega el anuncio de Ana (bloqueado a propósito) | Beto se lo reenvía: las tres usan el mismo y terminan iguales |
| Una pestaña trabada 1,6 s (como cargando la pista) en una red rápida | Sus respuestas llegan de 400 a 1400 ms, pero el retraso sigue en **3** |

`banco/pruebas/red` (la red mala de mentira, con reloj y azar falsos): **25/25**. Sin el parámetro no cambia nada;
lee bien `70,10,5`; bota exactamente los paquetes "udp" que tocan; lo "tcp" llega completo y en orden; las demoras
caen entre 60 y 100 ms.

**Con el juego** (`prueba-sincro`, dos pestañas en una carrera VS de verdad):

| Red | Retraso | Espera por cuadro (A / B) | Resultado |
|---|---|---|---|
| Esta PC (ida y vuelta 0–13 ms) | **3** | 0,00 / 0,00 ms | 10/10 |
| Red mala 70 ± 10 ms, 5 % perdido (ida y vuelta 132–199 ms) | **6** (100 ms) | 0,14 / 0,22 ms | 10/10 |
| La misma red mala con `?retraso=fijo` | 3 | **9,40 / 11,15 ms** (cámara lenta) | 9/10 |

`prueba-sincro` ganó un punto: "las dos usaron el mismo retraso en la carrera". También acepta `--puerto=` y
`--datos=` para correr varias a la vez o guardar cada corrida aparte.

**Qué significa para un jugador:** con amigos en la misma ciudad (ida de 10–30 ms) nada cambia: 3 cuadros. Con
alguien lejos, el kart responde unos 50 ms más tarde (6 cuadros en vez de 3). La carrera ya no va en cámara lenta,
que se nota mucho más.

### 5. La planilla de todas las pruebas (F1): `herramientas/correr-todo.mjs`

Corre en fila las pruebas del proyecto:

- banco, sitio y subida a R2;
- todas las del juego;
- cualquier `web/navegador/prueba-*.mjs` nueva, que entra sola.

Lee la cuenta que escribe cada una. Hay tres formatos: "N bien, M mal", "X de Y páginas bien" y "ℹ pass N" de
`node --test`. Al final muestra la tabla. Lo de cada prueba queda en `build/web/datos/todo/<fecha-hora>/`, con un
`resumen.json`. Termina con código 1 si algo falló.

- `--sin-juego`: solo las rápidas (~1,5 min). Dio **64 bien, 0 mal**.
- `--solo sincro,caida --repetir 5`: la misma prueba varias veces, cada corrida con su carpeta (y su puerto, si la
  prueba lo acepta). Sirve para cazar fallas intermitentes.
- `--lista`: muestra las pruebas y sale.

Van en fila y no a la vez porque las del juego comparten la tarjeta de video y algunos puertos.

### 6. El cuelgue al empezar la carrera (C4): no volvió

Antes salía 1 de cada 6 corridas (`Effects::Player::UpdateNonItemEffects`). Con `correr-todo --solo sincro
--repetir 8`, más unas 10 corridas sueltas de antes, **no salió ninguna vez en 18 corridas** (probablemente lo arregló
algo de §62–63). La única falla de esas 8 (8/9) fue otra: "sincronizar cuesta poco" con una espera de 684 ms. El
registro mostró la causa: la pestaña A bajaba los archivos de la carrera con la **caché vacía** justo al empezar
(878 lecturas, 97 MB, 37,6 cuadros por segundo un rato). Es el costo de la primera visita, no un error de la
sincronización. Queda para E2: bajar esos archivos durante los menús. Eso toca `mkw.mjs`, que estaba editando la otra
sesión. C4 queda en 🟡: se vuelve a mirar si reaparece.


### 7. Una PC lenta en la sala (C5) y el aviso de quién frena

**Qué pasa:** en la carrera sincronizada nadie avanza sin los botones de todos. Si la PC de un jugador no alcanza
60 cuadros por segundo, **toda la sala va a su ritmo**. Así fue diseñado (§62.3): saltarse dibujos para alcanzar
al reloj, como hace Retro Rewind solo, desincronizaba la carrera. Lo que faltaba era que la gente supiera por qué.

**La prueba** (`prueba-sincro --lento`: la pestaña B con la CPU frenada 2 veces por las DevTools de Chrome):

- la carrera sigue siendo la misma en las dos: 10–11 huellas iguales, nunca se separó;
- B va a ~30 cuadros por segundo y A la espera ~18–21 ms en cada cuadro; las dos avanzan al mismo paso.

El freno de Chrome exagera: "2 veces" dejó a B con ~33 ms de trabajo por cuadro, cuando normalmente son ~8,5 ms (ya
se había visto con los celulares emulados).

**El aviso** (`avisoLento` y `vigiaLento` en `lockstep.mjs`, cada 3 s desde `mkw.mjs`):

- `lockstep.mjs` anota a quién se esperó en cada cuadro (`esperaDe`: los que faltaban justo antes de poder seguir);
- si yo espero más de 4 ms por cuadro y la carrera va a menos de 55 cuadros/s: «La carrera va a 26 cuadros por
  segundo: espera al jugador 2 de la sala (su PC o su conexión no dan abasto)»;
- si yo casi no espero pero igual voy a menos de 50: «Tu PC no alcanza 60 cuadros por segundo (va a 29): la sala va
  a tu ritmo»;
- solo si **dos ratos seguidos** (6 s) salen mal. La primera versión avisaba con un solo rato, y en una carrera
  normal B mostró «Tu PC no alcanza» por el tirón de la largada: con la caché vacía la pista se baja al empezar
  (medio segundo congelado y un par de segundos a 25 cuadros/s). Eso no es una PC lenta.

**Por qué "el jugador 2 de la sala" y no su nombre:** la página del juego solo recibe los identificadores de la sala
(`?sincro=uid1,uid2`), no los nombres. Pasar los nombres pide cambiar la sala del sitio y volver a armar sus paquetes;
queda anotado para C6, junto con la cola de pistas.

**Pruebas:**

- banco `lockstep` **35/35**: la espera se anota a quien se esperó (Ana esperó 3052 ms, todos por Beto); la cuenta
  del aviso con fotos inventadas (a 60 nada; a 30 esperando, «jugador 2»; a 30 sin esperar, «Tu PC»; sin carrera,
  nada); un tirón suelto no avisa y dos ratos seguidos sí;
- `prueba-sincro` normal: **11/11**, con el punto nuevo «sin avisos de sala lenta»;
- `prueba-sincro --lento`: **11/11**. Cambian dos puntos: «A la espera, sin esperas en B» y «A avisa "espera al
  jugador 2", B avisa "Tu PC no alcanza"».

### Trampas

- **El `\b` que se volvió un byte:** el cambio a `lockstep.mjs` se aplicó con un script de Python. Dentro de un texto
  normal de Python, `\b` es el carácter 8 (retroceso), no las dos letras. La expresión regular de JavaScript
  `/[?&]retraso=fijo\b/` quedó con un byte invisible y `?retraso=fijo` dejó de funcionar sin dar error. Se arregló
  reemplazando el byte y revisando que no quedara ninguno. Para la próxima: textos "crudos" de Python (`r"..."`).
- **El banco necesita "menús" largos:** con 1 de cada 7 paquetes perdido, en 2,5 s quedan apenas 3 medidas. El banco
  espera 6,5 s antes de la carrera lenta. En el juego los menús duran más que eso.
- **Las pruebas del banco tienen que detener los pings** (`ls.detener()`) antes de terminar. Si no, los relojes de
  0,5 s siguen andando.
- **`prueba-sincro` decía siempre "registro en build/web/datos/sincro/"** aunque se le diera `--datos=`; ahora
  muestra la carpeta de verdad.

```bash
node banco/correr.mjs lockstep red
node web/navegador/prueba-sincro.mjs
node web/navegador/prueba-sincro.mjs --puerto=8123 --datos=build/web/datos/c3b-redmala --extra=&redMala=70,10,5
node web/navegador/prueba-sincro.mjs --extra=&redMala=70,10,5&retraso=fijo
node herramientas/correr-todo.mjs --sin-juego
node herramientas/correr-todo.mjs --solo sincro --repetir 8
```

## 2026-10-19 · §71 Abrir directo por código, y Retro WFC entrando solo por la página

### Qué pidió el dueño (2026-10-19)

1. «Saltar la interfaz» es **abrir directo esa pantalla usando el código del juego**, no tapar la ventana con una
   cortina mientras un piloto aprieta botones por detrás. «Si no puedes, decompila el juego.» «Abrir directo es
   literalmente abrir directo.»
2. El multijugador hecho hasta ahora (la carrera sincronizada con CPU, §61) estaba mal: los bots solo seguían la pista,
   la cámara parecía un espectador flotando sobre la largada, y no se podía elegir personaje, kart ni pista.
3. Después: «si es imposible poner exactamente los mismos CPU del modo un jugador, salta ese paso y **simplemente
   implementa el Retro WFC, modificado para que corra en la página** bajo mi modo de funcionamiento». Cuando eso
   funcione, separarlo en 3 modos: el original y los dos propuestos (copa y playlist).
4. Faltaba en `docs/en-linea.md` la investigación de qué se hace una vez dentro de Retro WFC (el bucle de juego): está
   agregada (una tabla con fuentes: mkwiiki y el código público de Retro Rewind).
5. Los Mii invitados del juego para el menú «cambiar Mii»: **después** de terminar el multijugador al 100 %.

### Por qué la carrera sincronizada se veía mal (lo que se encontró)

En la carrera sincronizada **todos** los karts, también los humanos, eran del tipo "CPU" (`semillas_nativo.cpp`): un
humano era una CPU que leía el mando. Por eso las CPU de verdad no tenían "contra quién correr" (la CPU ajusta su
manejo mirando al jugador humano) y la cámara era la de espectador, movida a mano al kart propio. Arreglarlo de verdad
pide humanos "locales" en cada consola, como el multijugador de pantalla dividida. Con el pedido 3, eso queda para los
modos copa/playlist si hace falta; primero va el modo en línea del propio juego, que ya trae la cámara, la elección de
personaje y la votación de pista.

### 1. El motor de abrir directo (`web/juego/directo_nativo.cpp` + `web/navegador/directo.mjs`)

- **El gancho**: el Update del SectionMgr (una vez por cuadro). Retro Rewind trae su versión de esa función
  (`rr_overlay_8063550C`), y el bucle del juego llama a esa; por eso se envuelve esa (en `compilar-web.py`,
  `REEMPLAZOS`). Las funciones del juego se llaman con `InvokeDirectCpu<dirección>`, que elige la versión activa
  (la de RR si la parcheó), igual que el código traducido.
- **El pedido**: la página llama `Module._mkw_directo_ir(sección, licencia)`. En los Update siguientes, con el
  SectionMgr quieto (sin otro cambio en marcha), el juego:
  1. registra el mando del jugador 1 (como el título al apretar A) y espera 3 cuadros;
  2. elige la licencia 1, copiando paso a paso lo que hace la pantalla de licencias (0x805EB7A0): `ChangeLicense`,
     el número de licencia, `SetCurLicense` y el Mii de la licencia (`LoadStoreMii` con su CreateID). Si la partida es
     nueva, antes la **crea** con `CreateLicense`, como «Crear licencia» (0x805ECF2C), y pide guardar;
  3. `SetNextSection(sección)` + `RequestSceneChange(0, negro)`.
  Nada de esto corre si el juego todavía no leyó el archivo de guardado (así no se pisa una partida que no cargó).
  Sin licencia (partida nueva y sin Mii) no salta: un menú sin Mii deja al juego esperando para siempre (se vio).
- **El Mii para una licencia nueva**: antes de arrancar, `prepararMii` mira la base de Mii (RFL_DB.dat); si está
  vacía pone un Mii con el nombre de la persona (y se guarda, para que la próxima vez sea el mismo).
- **La acción de un botón, directo**: `Module._mkw_directo_boton(función, página, botón)` llama en el Update siguiente
  a la función del botón (la misma que corre cuando alguien lo aprieta), con la página y el botón de verdad. Solo las
  de una lista (en el C++ y en `directo.mjs`, `BOTON`), y solo con la página **activa** (estado 4).
- `?directo=0` vuelve al camino viejo (el piloto apretando botones), para comparar.

### 2. Un jugador directo

El menú de inicio «JloKart Wii» → Single Player ya no usa el piloto: `directo.ir(0x48)`. El juego pasa del título al
menú «Un jugador» en ~1 s, con la licencia elegida (o creada) y el mando listo: A entra a Grand Prix → «Engine
Classes» (probado con `guion.mjs`). **Sin cortina**: lo que se ve es el propio fundido a negro del juego al cambiar de sección (la cortina era
para tapar al piloto apretando botones; aquí no hay piloto). `directo.ir()` da por hecho el salto recién cuando la
sección nueva **tiene su página** (al principio la sección ya cambió pero sus páginas todavía se están cargando).

### 3. Retro WFC directo (el modo en línea del juego, por la página)

Con `?modo=enlinea` (la sala), cuando la red de la sala está lista: `directo.ir(0x55)` (la sección en línea) y después,
a medida que aparecen, las acciones directas de las pantallas del juego que piden confirmar algo:

| Página | Qué es | Acción llamada directo |
|---|---|---|
| 0x85 | Aviso de datos de Nintendo WFC | «Siguiente» (`WFCDataStatement::OnButtonClick`, botón +0x578, número 2) |
| 0x86 | «¿Conectarse a Nintendo WFC?» | «Sí» (`WFCAllowData::OnButtonClick`) |
| 0x84 / 0x50 | Conectando (el juego entra a nuestro WFC virtual) | — (solo) |
| 0x4D | Cartel «Welcome to Retro Wi-Fi Connection!» | cerrar (`Click::OnClick`) |
| 0x8B | Menú de Retro WFC | «Mundial» (`WFCMainMenu::OnWorldwideButtonClick`) |
| 0x8F | Buscando rivales | — (el juego sigue solo: elegir personaje/kart/derrape con su reloj, votación, ruleta, carrera) |

El resto es el bucle del propio juego (Retro WFC): la persona elige con su mando; si no elige, el reloj del juego elige.

### Trampas

- **El gancho en la función equivocada**: Retro Rewind cambia `SectionMgr::Update`; envolver `func_8063550C` no hacía
  nada (el juego llama a `rr_overlay_8063550C`). Se ve en la tabla de registro del C++ traducido
  (`FunctionKind::ModTranslated`, prioridad 100).
- **Saltar sin licencia cuelga el juego**: el menú «Un jugador» carga el modelo del Mii del jugador y, sin licencia,
  se queda esperando para siempre («OSSleepThread … could not switch away»). Ahora sin licencia no se salta.
- **El mando "interrumpido"**: anotarlo en la casilla del jugador 1 no alcanzaba (la pantalla nueva lo veía
  desconectado). Faltaba que el portador del jugador 1 **tome el mando de GameCube** (Input::Manager +0x3BA0: los de
  GameCube; los Wiimote están en +0x1720), y esperar 3 cuadros antes del salto.
- **La acción del botón que se perdía**: se llamaba cuando la página ya estaba arriba pero todavía entrando; su
  OnActivate la borraba. Ahora se espera el estado 4 (activa) y se repite si a los 2 s la página sigue ahí.
- **Leer la memoria de la Wii antes del main** lanza una excepción del wasm («Exception» en la consola): `ir()`
  preguntaba primero si el guardado estaba leído. Ahora mira primero que haya una sección.

### Pruebas

- banco `directo` **16/16** (sin el juego): la base de Mii vacía recibe un Mii con su suma de control; con Mii no se
  escribe nada; el salto se pide recién con el guardado leído y sin otro cambio en marcha; sin licencia, no; el Mii
  queda en el buffer del juego; la acción de un botón solo con su página arriba y activa.
- `guion.mjs` con el juego: título → «Un jugador» directo, sin el cartel del mando; A → «Engine Classes».
- `prueba-inicio` **14/14**: Single Player en el menú «JloKart Wii» → el menú se va, **no** aparece la cortina y el
  juego queda en su menú «Un jugador» (página 0x69) abierto directo. (Las dos comprobaciones viejas esperaban la
  cortina «Entrando a Single Player…» del piloto: se cambiaron a lo nuevo.)
- Repaso (`correr-todo --solo banco,inicio,menus,piloto,enlinea-sala`): banco 24/0, piloto 9/0, menús 8/0, sala en
  línea 11/0; las pruebas del sitio de Mario Kart (`mkw`, `mkw-worker`, `juegos`, `solo`) 46/46.
- `prueba-enlinea` **9/9** (dos pestañas, la malla WebRTC de verdad, el WFC virtual en la de A): las dos entran
  directo a la sección en línea, pasan solas las pantallas de la tabla, se juntan buscando rivales (120 s, con el
  reloj de elegir personaje del juego), votan (127 s) y corren la carrera en línea (164 s); los paquetes del juego
  cruzan la malla (~800 por lado) y el WFC le da al juego el VR presentado.

```bash
node banco/correr.mjs directo
node web/navegador/guion.mjs "X:6000 -:2000 K:3000" --mii --evaluar "(mkwDirecto.ir(0x48), 1)"
node web/navegador/prueba-enlinea.mjs
```

## 2026-10-19 · §72 Los tres modos de la sala: Retro WFC, copa y playlist (y 45 s para elegir)

### Qué pidió el dueño

Con el Retro WFC del juego corriendo por la página (§71), separarlo en **tres modos**: el original y los dos
propuestos (copa y playlist); al crear una sala, elegir el **modo** (no «cuántas personas»); y **45 s** antes de cada
carrera para elegir personaje, kart y ajustes.

### Cómo quedó (la idea en una línea)

Los tres modos son **el mismo modo en línea del juego**; la página solo cambia tres cosas: el número con que arranca el
reloj de elegir, la decisión del anfitrión (pista y cilindrada) y cuándo se termina (contando carreras).

| Modo | Qué hace | Quién lo hace |
|---|---|---|
| Retro WFC | El bucle del juego sin fin: elegir, votar, ruleta, carrera, VR | el juego |
| Modo copa | N carreras (2, 4, 8 o 12) con la cilindrada del anfitrión; al terminar la última, la tabla y todos al vestíbulo | `modos.mjs` cuenta y suma; `modos_nativo.cpp` fija la cilindrada |
| Modo playlist | Una cola de N pistas sorteada por la sala; cada carrera es la siguiente; al vaciarse, la tabla y al vestíbulo | `modos_nativo.cpp` cambia el voto de cada uno y la decisión del anfitrión por la pista de la cola |
| (los tres) | 45 s para elegir personaje, kart y pista | `modos.mjs` cambia el 30.0 del juego por 45.0 |

### 1. Los 45 s: un número en la memoria del juego

La cuenta regresiva de elegir/votar es un objeto `CountDown` (Pulsar: `UI/Ctrl/CountDown.hpp`) que vive en la página
`SELECTStageMgr` (0x90, +0x6C). Se arranca con `CountDown::SetInitial(segundos)`, pero el juego tiene esa función
"pegada adentro" (el traductor la copió en cada llamador: «inline leaf 0x805C3C2C»), así que envolverla no alcanza.
Lo que sí se puede cambiar es **de dónde saca el 30**: `SELECTStageMgr::OnResume` (0x806507A0 y su versión de Retro
Rewind) lee el número de 0x80899EF4 (una constante de StaticR.rel). Se leyó la memoria del juego andando: 0x80899EF4 =
0x41F00000 = 30.0 (y al lado, 15.0, 20.0 y 10.0 de otros relojes). En el C++ traducido nadie más lee esa dirección.
La página la cambia por 45.0 (`ponerReloj`) apenas carga StaticR.rel, y **solo si encuentra el 30.0** (si el programa
cambiara, no pisa otra cosa). `?eleccion=30` deja el reloj del juego.

### 2. La cilindrada y la pista: las decisiones del anfitrión (`web/juego/modos_nativo.cpp`)

En línea, el anfitrión de la sala del juego decide y manda el resultado en el paquete SELECT. Retro Rewind cambió esas
decisiones por funciones suyas (Pulsar, `Network/PulSELECT.cpp`, leído en GitHub; GPL: solo se lee): `DecideTrack`
(en el C++ traducido `rr_kamek_81864290`) y `DecideCC` (`rr_kamek_81864878`), llamadas desde 0x80661490 y 0x80661404.
Se envuelven (`compilar-web.py`, REEMPLAZOS) y después de la de Retro Rewind se escribe lo de la sala:
- cilindrada: `engineClass` (handler +0x8 +0x37) = 1 (100cc), 2 (150cc) o 3 (espejo);
- pista: `pulWinningTrack` (handler +0x8 +0x3A, u16) = la de la cola, y la variante en 0.
Además el voto de cada consola (`SetPlayerData`, 0x80660750 → `rr_overlay_80660750`, r6 = voto) pasa a ser la pista de
la cola: así la ruleta muestra la misma pista en todas las tarjetas. El voto "sin elegir" (0x43) no se toca: si se
cambiara, el juego creería que todos ya votaron mientras eligen personaje.

### 3. Contar carreras y sumar puntos (`web/navegador/modos.mjs`)

Cada 300 ms: si la sección es una carrera en línea (0x68-0x77) y la etapa de Raceinfo (+0x28) es 4 ("terminada para
todos"), se cuenta una carrera (una vez) y 2,5 s después se leen los puntos de Racedata (por jugador: antes +0xD8,
ahora +0xDA; si el juego no los anotó, por puesto con 15/12/10/8/7/6/5/4/3/2/1/0) y el nombre del Mii. Al llegar a N:
9 s para ver los resultados del juego, la tabla final encima (14 s) y el aviso a la sala.
Arriba, un cartel chico: «Modo copa · carrera 2 de 4» o «Playlist · 2 de 5 · <nombre de la pista>» (el nombre sale de
la memoria del juego, `leerNombres`).

### 4. La sala del sitio

- Crear sala: **solo el modo** (Retro WFC / copa / playlist); caben 12 siempre (antes pedía también «Jugadores»).
- Vestíbulo: el anfitrión elige el modo (tarjetas), las carreras o pistas (2, 4, 8, 12) y la cilindrada (150cc, 100cc,
  espejo, al azar).
- La cola de la playlist la sortea cada navegador igual con la sala y la tanda (`mkwPlaylist`), y va en la dirección
  del marco (`?pistas=13.2,0.1,…`).
- Al terminar la copa o la playlist, el marco del anfitrión manda `{tipo:'fin', tabla}`; la sala anota la vuelta al
  vestíbulo con la tabla (limpia: `mkwTabla`) y el vestíbulo la muestra como «🏆 Última copa».

### 5. El corte a los 30 s de carrera: el control de inactividad del juego

La primera prueba con el juego de verdad (`prueba-modos`) llegaba hasta la carrera y a los ~35 s las **dos** pestañas
mostraban «You were disconnected from the other players». Siempre en el mismo cuadro de carrera (1802), en las dos.
Se fue descartando una cosa por vez:

| Sospecha | Cómo se miró | Resultado |
|---|---|---|
| La red pierde paquetes | Las cuentas de la pila de red de la página cada 2 s | ~35 paquetes/s por lado, ninguno perdido |
| Un error de la conexión (DWC) | `errorParams` de RKNet (+0x2C/+0x30) en un muestreo cada 4 ms | Siempre 0 |
| Retro Rewind rechaza un paquete (suma de control) | Build de depuración que envuelve CheckPacket de Pulsar (`depurar_paquetes.cpp`) | Nunca marcó a nadie |
| ¿Quién apaga la conexión? | Punto de vigilancia sobre RKNet +0x2755 (`shutdownScheduled`) | Lo escribe `Section::ScheduleDisconnection` (0x80623054) llamada por `DisconnectMgr::OnUpdate` (0x80649590) en el cuadro 1802 |

Leyendo el C++ traducido de `DisconnectMgr::OnUpdate`: corta si alguna de estas marcas está puesta: (a) en carrera en
línea, un byte del objeto del modo de juego (`Raceinfo +0x10` → `GMDataOnlineVS +0x114`); (b) un byte de 0x809C1F50;
(c)/(d) demasiado tiempo en ciertas pantallas (3600 o 10800 cuadros). Quién escribe `GMDataOnlineVS +0x114`
(se buscaron en el C++ traducido todas las escrituras de un byte en +276): cuatro funciones que `GMDataOnlineVS::Update`
llama en cada cuadro:

| Función | Qué mira | Cuándo marca |
|---|---|---|
| 0x8053F184 (del juego original) | Para cada piloto de esta consola: ¿cuántos cuadros lleva su mando sin que se toque nada? (`InputMgr`, 0x805235D4, con 1800 y 3600) | **1800 cuadros = 30 s quieto** (si no terminó la carrera) |
| `rr_overlay_8053EE50` (Retro Rewind) | La velocidad del kart: si va más lento que un umbral 300 cuadros seguidos, empieza a contar | 3600 cuadros más (si la opción de RR está activa) |
| 0x8053F2A4 (el propio Update) | El reloj de la carrera | 21605 cuadros = 6 min (carrera demasiado larga) |

En la prueba **nadie toca un botón** durante la carrera, así que el cuadro 1802 es exactamente 1800 cuadros quietos
más los 2 de la cuenta: es el **control de inactividad del juego original** (en la Wii de verdad pasa lo mismo si uno
deja el mando en la mesa). No es una falla del port: una persona que maneja nunca lo ve, y por eso no se toca en el
juego.

Para la prueba sí hacía falta llegar a la meta (si no, no hay puntos ni tabla). Se agregó en `modos_nativo.cpp` un
pedido de la página, `mkw_modos_terminar()` (`window.mkwTerminarCarrera()` en la página): en el cuadro siguiente,
dentro de 0x8053F184 (corre en cada cuadro de la carrera en línea), llama a `RaceinfoPlayer::EndLap` (0x805349B8, la
función que corre al cruzar la meta, en su versión de Retro Rewind) hasta pasar la última vuelta, para cada piloto de
esa consola. Todo lo demás lo hace el juego como siempre: el tiempo final, el puesto, avisar a la otra consola, los
puntos, la pantalla de resultados. `prueba-modos` lo pide a los 10 s de carrera (600 cuadros) en cada pestaña;
`--sin-terminar` deja ver el corte por inactividad.

### 6. La playlist se colgaba: entrábamos a la sala equivocada (la de solo pistas de Nintendo)

La primera playlist con el juego no pasó de la votación: después de 45 s el juego mostró «You were disconnected from
the other players» (la página 0x51, un cartel; foto `playlist/A-cartel.png`) y el anfitrión nunca decidió. Leyendo
Pulsar (`SlotExpansion/CupsConfig.cpp`, `ToggleCTs`): en una sala **Mundial** (`ROOMTYPE_VS_WW`) Pulsar deja **solo las
32 pistas de Nintendo** (`isRegsOnly`); cualquier voto de una pista retro (id ≥ 0x100) se toma como «sin votar»
(`PulSELECT.cpp`: `!IsValidTrack(vote)` → `NO_TRACK_SELECTED`), así que el anfitrión esperaba votos que nunca llegaban
y el juego cortó. En la copa no se notó porque ahí vota el juego: salieron 0x08 y 0x13, también de Nintendo.

El problema de fondo era más grande: **el Retro WFC de Retro Rewind no es la sala Mundial**. RR v6.13 esconde los
botones «Regional/Mundial» del menú Wi-Fi y muestra los suyos (Pulsar, `Settings/UI/ExpWFCMainPage.cpp`):

| Botón de RR | Qué llama | Sala |
|---|---|---|
| Main modes (las retro) | `OnRegionalButtonClick` (0x8064BDC4) | Regional; luego en la página de modos (0x8C): VS = región 0x0A (retros), CT = 0x14, Regulares = 0x15, 200cc = 0x0C, OTT = 0x0B, Lluvia de objetos = 0x0D |
| Other modes (customs) | el mismo, recordando el 7 | Regional |
| Battle modes | el mismo, recordando el 8 | Regional, batalla (0x0E / 0x0F) |

Abrir directo (§71) llamaba al botón **Mundial escondido** (0x8064BCE8) y al VS del juego (0x8064C610): eso es la sala
de las pistas de Nintendo, no la de RR. Ahora entra como una persona en RR: «Regional» (0x8064BDC4, botón +0x484: lo
mismo que hace «Main modes») y en la página de modos el VS **con la versión de RR** (`ExpWFCModeSel::OnModeButtonClick`,
en el C++ traducido `rr_kamek_8183FCC0`; se encontró buscando la función de RR que escribe las regiones 10, 11, 12, 13,
14, 15, 20 y 21): fija la región 0x0A (retros), actualiza los «contextos» de Pulsar y llama a la del juego.
`?wfc=mundial` deja la entrada de antes (para comparar).

### Trampas

- **`SetInitial` está "pegada adentro"**: envolver la función del reloj (0x805C3C2C) no cambia nada, porque el
  traductor copió su cuerpo dentro de cada llamador («inline leaf»). Lo que se cambia es la constante que lee.
- **El voto «sin elegir» (0x43) no se toca**: si se cambiara por la pista de la cola, el juego creería que todos ya
  votaron mientras todavía eligen personaje, y saltaría la votación.
- **Un corte parecía una carrera terminada**: al desconectarse, el juego pasa unos cuadros por la etapa 4 dentro de la
  sección de carrera antes de ir al aviso (0x79). La copa la contaba. Ahora se vuelve a mirar 2,5 s después: si saltó
  a 0x78/0x79, la carrera no cuenta.
- **El corte a los 30 s no era de la red**: era el control de inactividad del juego (sección 5). Se tardó en verlo
  porque las dos pestañas se cortaban a la vez y la red no perdía nada; lo que lo destrabó fue el punto de
  vigilancia sobre `shutdownScheduled` y leer `DisconnectMgr::OnUpdate` en el C++ traducido.
- **El reloj de la página antes de StaticR.rel**: la constante vive en StaticR.rel, que se carga después del arranque;
  `ponerReloj` se reintenta cada 300 ms hasta encontrar el 30.0 (y no escribe si encuentra otra cosa).
- **Dos pilotos con el mismo nombre**: en la prueba las dos pestañas comparten el guardado del navegador (mismo
  perfil), así que las dos licencias tienen el mismo Mii «PilotoA». La suma separa nombres repetidos por su número de
  jugador; en dos PC distintas cada una tiene su Mii.
- **La sala Mundial de Pulsar es solo de pistas de Nintendo**: con RR el modo en línea de verdad es «Main modes»
  (Regional + VS de RR, región 0x0A). Un voto de una pista retro en la Mundial se toma como «sin votar» y la elección
  termina en un corte.
- **La función de terminar es solo para pruebas**: no la llama la página por su cuenta; está para que una prueba sin
  manos llegue a la meta.

### Pruebas

- banco `modos` **24/24** (sin el juego, memoria falsa): el reloj pasa a 45 solo si encuentra el 30.0; `pistasDe`
  descarta lo inválido; la copa cuenta una vez por carrera, suma por nombre (repetidos separados), ordena por puntos;
  un corte (0x78/0x79 después de la etapa 4) no cuenta; la playlist pone la pista siguiente; Retro WFC no cuenta nada.
- banco `directo` **18/18** (dos nuevas: el botón Regional y el VS de RR).
- Sitio: `mkw.test` 16/16 (cilindrada, cola de la playlist, tabla limpia) y el resto de Mario Kart y Juegos: 47/47.
- `prueba-modos` **9/9** con el juego (dos pestañas, la malla WebRTC de verdad, la sala de las retro): reloj en 45 s
  (máximo visto 44,6 s), el anfitrión decide con 100cc, las dos corren la pista decidida (0x100, una retro) a 100cc,
  a los 10 s de carrera cada una la termina por código, cuentan 1 de 1, arman la misma tabla (15 y 12), muestran el
  cartel final y avisan el fin; nadie se desconecta.
- `prueba-modos --playlist` **9/9**: el voto y la decisión son la pista de la cola (0x136, una retro de RR con
  «Music: Isana Remix» y 2 vueltas), en espejo (150cc + la bandera de espejo), tabla y fin igual que la copa.
- `prueba-modos --sin-terminar` (antes del arreglo de la prueba): el corte por inactividad en el cuadro 1802 de las dos.
- `prueba-enlinea` **9/9** con la entrada nueva (Regional + VS de RR): buscando rivales a los 121 s, votación a los
  127 s, carrera en línea a los 179 s, ~940 paquetes por lado sin perder ninguno.

```bash
node banco/correr.mjs modos directo
node web/navegador/prueba-modos.mjs
node web/navegador/prueba-modos.mjs --playlist
node web/navegador/prueba-enlinea.mjs
```

## 2026-10-19 · §73 La sala sin Retro WFC: la copa con el selector de la página, los personajes en el juego y todos largando juntos

### Qué pidió el dueño (2026-10-19)

Probando `jugar.bat` vio «Connecting to Retro WFC» y se quedó pegado. Aclaró que Retro WFC era **solo un ejemplo** del
ciclo de juego: el multijugador **no** debe conectarse a ese servidor ni mostrar ninguna pantalla del Wi-Fi del juego,
ni el menú de licencias, ni el título de Retro Rewind: «haz que todo entre directamente donde tiene que estar». El
recorrido que quiere (por ejemplo, Modo copa):

1. el **vestíbulo de la página** (la sala del sitio);
2. con los pilotos confirmados, el anfitrión **elige la copa con el selector de la página** (la lista de pistas con su
   foto, los logos de las copas y el plano de cada pista: el de «Copa a tu gusto»);
3. cada uno **elige personaje y vehículo en el juego**;
4. se corre. «Si no puedes hacer eso directo, decompila el juego.»

Y dos cosas más durante el trabajo: **no usar la cortina para apretar botones por detrás** («debes abrir directamente
todo») y **que todos empiecen la carrera al mismo tiempo** (en una prueba suya el jugador 1 salió 2 s antes porque
cargó primero).

### La idea en una línea

Cada navegador corre la MISMA carrera (el lockstep de §61), con los humanos como **jugadores locales de verdad** en
todas las consolas y la CPU de un Grand Prix completando los 12; la carrera se abre **por código** escribiendo la
**ficha** en Racedata y saltando con SectionMgr (§71), y un **árbitro** de la página (`sala-carrera.mjs`) lleva la sala
de un paso al otro.

### 1. La carrera directo desde el arranque (`directo_nativo.cpp`, `directo.mjs`)

- **La ficha**: `armarFicha({pista, cc, cpu, humanos, semilla, carrera, carreras…})` arma pista, cilindrada, espejo,
  nivel de la CPU, objetos, número de carrera, semilla y los 12 puestos (los humanos en su orden, cada uno con su mando;
  los CPU con personajes distintos sorteados con la semilla). `escribirFicha` la copia a Racedata igual que la dejan
  los menús (lo comprobamos con `herramientas/ficha-carrera.mjs`, que guarda la ficha de una carrera armada a mano con
  los menús): la pista de RR con `CupsConfig::SetWinning` de Pulsar, los ajustes, cada jugador (tipo, personaje,
  vehículo, mando, pantalla, equipo, tipo de mando), SectionParams (personajes, vehículos, número de carrera).
- **Sin título ni licencias**: envolvemos `SectionMgr::Init` (la versión de RR, `rr_overlay_80634E44`). Justo después
  de que el juego pone su **sección de arranque** (0x3F, el título), si la página ya pidió algo (y el guardado está
  leído, cuando hace falta elegir licencia), la cambiamos por la que se pidió: la carrera (0x20) o la pantalla de elegir
  personaje (0x49). El título y las licencias ni se crean: la prueba mira cada 100 ms y nunca los ve, ni debajo de la
  pantalla de carga.
- **La presentación de la pista**: el «vuelo» por la pista antes de la carrera es la sección 0x1A con el tipo «carrera
  de CPU» (gametype 5); por omisión se salta directo a 0x20 con el tipo normal (0). `?intro=1` la pone.
- **Elegir personaje y vehículo con las pantallas del juego** (sección 0x49: personaje 0x6B → vehículo 0x6C → la de
  RR 0x10E → derrape 0x6D). Al confirmar el derrape el juego seguiría a las copas (0x6E): envolvemos las tres funciones
  con que puede seguir (`Page::ChangeSectionBySceneChange` de RR, `LoadNextPageById` y `LoadNextPageWithDelayById`) y,
  en el modo "elegir", en vez de seguir, el juego le avisa a la página lo elegido (`Module.mkwAlElegir`: personaje,
  vehículo, derrape).

### 2. Varios humanos de verdad en la misma carrera (`semillas_nativo.cpp`)

La carrera sincronizada vieja ponía a todos como CPU (los CPU no tenían contra quién competir y la cámara parecía la de
un espectador). Ahora cada humano es un **jugador local de verdad** (tipo 0) en todas las consolas, con su puerto de
mando (0 a 3). Eso trajo tres problemas, uno detrás del otro:

1. **Pantalla partida y un cuelgue.** Con 2 locales el juego quiere 2 pantallas (sección 0x21) y se colgaba al armar
   los avisos de objetos (`ItemWarningMgr::Init` recorre a los jugadores locales según la tabla de pantallas, y la
   tabla tenía uno solo). Arreglo: la **pantalla propia**: la tabla de pantallas lista a TODOS los humanos (los cuenta
   igual en todas), con el de esta consola primero, y "cuántas pantallas" queda en 1. La ficha va con `pantallas = 1`
   (sección 0x20).
2. **«Se interrumpió la comunicación con el mando. Presiona A».** El juego revisa en cada cuadro el mando de cada
   jugador local (`SectionPad::GetFirstDeactivatedPad`, 0x8061B9BC): los de los otros humanos no están enchufados en
   esta consola. Envolvemos la función: con humanos de la sala, "ninguno desconectado".
3. **El derrape de cada uno.** El botón del juego deja el derrape (manual o automático) en el portador del mando del
   jugador 1 de esa consola. Ahora el plantel lleva el derrape de cada humano (5 números por puesto: vehículo,
   personaje, tipo, mando, derrape) y se escribe en el portador de SU mando (`RealControllerHolder::SetDriftType`,
   0x80520F2C).

### 3. El árbitro de la sala (`web/navegador/sala-carrera.mjs`)

Las fases: **copa** (el anfitrión arma la copa; en la playlist ya viene armada) → **elegir** (45 s; a quien no alcanza
se le pone uno) → **correr** la carrera n (todos arman la misma ficha y saltan; al terminar, 9 s de resultados y la
siguiente) → **fin** (la tabla de la copa, leída del juego, va a la sala del sitio). Manda el anfitrión: cada segundo y
en cada cambio reparte el estado entero (así quien recarga se pone al día); los demás le avisan lo suyo. Los mensajes
van por la malla con la marca 0xA8 (los del lockstep llevan 0xA7). Quien recarga la página con la copa andando entra en
la carrera siguiente. Si el anfitrión se va, la sala del sitio nombra a otro y se lo avisa al marco
(`cambiarAnfitrion`): el nuevo sigue desde su copia, sin recargar.

En la página (`mkw.mjs`, `?modo=sala`): el juego arranca directo en la pantalla de personaje; la anfitriona ve encima
el selector de la página (con tantas casillas como carreras); los demás, «El anfitrión está eligiendo la copa…»; con la
copa lista, la cuenta de 45 s; después cada carrera abre directo. La CPU es la de un Grand Prix: su nivel sale de la
cilindrada (50cc fácil, 100cc normal, 150cc y espejo difícil); «al azar» sortea la cilindrada de cada carrera como RR
(10 % 100cc, 65 % 150cc, 25 % espejo) con la semilla de la sala.

### 4. Todos largan juntos

El lockstep ya lo garantiza: ninguna consola avanza un cuadro sin los botones de todas, así que la que llega primero a
la carrera queda **quieta en el primer cuadro** hasta que llega la última, y la cuenta regresiva empieza en el mismo
cuadro para todas (en la prueba: A esperó 0,9 s a B). Lo que faltaba era decirlo: ahora la página muestra «Esperando a
que el jugador 2 termine de cargar la pista: la carrera empieza al mismo tiempo para todos…» mientras espera (también
cuando lo que se espera es el anuncio del retraso del decisor). Se espera hasta 45 s a quien viene cargando; a quien
ya estaba y se corta, el margen de 30 s.

### 5. Dos fallas que encontró la prueba de la sala

- **Recursión sin fin en la anfitriona.** Al confirmar lo elegido, la anfitriona se lo avisaba a sí misma → eso
  cambiaba el estado → el cambio volvía a avisar lo elegido → … hasta «Maximum call stack size exceeded» y 19 s con la
  pestaña trabada. Arreglo en los dos lados: la página reenvía lo suyo solo si el anfitrión todavía no lo tiene, y el
  árbitro ignora un aviso igual al que ya tenía (**idempotente**).
- **Interbloqueo al pasar a la carrera 2.** La anfitriona saltó a la 2 y dejó de mandar botones de la 1; B iba unos
  cuadros atrás y quedó esperando esos botones con el juego detenido (en el lockstep el juego espera dentro de la
  lectura del mando), y con el juego detenido no podía saltar. Arreglo (`lockstep.fijarCarrera`): si el juego está en
  medio de otra carrera, se suelta la espera y los últimos cuadros de la vieja van **sin esperar y con todos quietos**
  (ya nadie más los corre); la nueva empieza cuando el contador de cuadros vuelve atrás. (Un primer intento no hacía
  nada: pedir «la 2» estando en la 1 no cambiaba el número, porque el contador ya iba a pasar solo a la 2; lo pilló el
  banco.)

### 6. La pantalla partida: la memoria decía 1 y la imagen mostraba 2

Mirando las **fotos** de la prueba (no solo los números) apareció la pantalla partida en las dos pestañas: arriba un
kart, abajo el otro, con dos HUD. La tabla de pantallas decía lo correcto; la imagen, no. Cómo se encontró y arregló:

1. **Una prueba que mira la imagen** (`web/navegador/foto-pantalla.mjs`): compara cada fila de píxeles con la de arriba;
   en la costura entre dos vistas el salto es mucho mayor que el típico (como buscar un escalón en una señal por el
   pico de su derivada). Calibrada con fotos de verdad: partidas 17,7 y 21 contra un típico de 3,5; una sola vista
   ≤ 4,7. Ahora va en `prueba-sincro --directa` y en `prueba-sala`.
2. **Los tres conteos del escenario** (+0x4 jugadores, +0x5 pantallas, +0x6 locales: los calcula
   `ComputePlayerCounts`, 0x8052F788). Yo ponía pantallas = 1, pero durante la carrera valía 2. Escribirlo en plena
   carrera no cambia nada: las vistas se arman al construir la escena.
3. **El punto de vigilancia** (§62) sobre esos bytes dijo quién los escribía: la **versión de Retro Rewind** de
   `RacedataScenario::Init` (`rr_overlay_8052FB90`) los vuelve a escribir al final, **después** de InitRng (donde estaba
   mi gancho). Además prepara el escenario de los **menús**, que después se copia a la carrera. El arreglo va
   envolviendo esa función: al terminar, la pantalla propia.
4. Con 1 pantalla y 2 locales el juego **se caía** en el HUD: los globos con el nombre y con el objeto de los otros
   pilotos (`CtrlRaceNameBalloon`, `CtrlRaceItemBalloon`) se arman por cada jugador local (`Pages::RaceHUD::
   GetCtrlRaceBaseCount` lee +0x6) y los del segundo buscaban la cámara de una pantalla que no existe (leían fuera de la
   lista de pantallas, 0x809C1868). Quitarle el lugar de pantalla al otro humano tampoco servía.
5. **El arreglo: un solo jugador local por consola** (el propio): pantallas = 1 y locales = 1. El otro humano sigue
   siendo persona (tipo 0) en todas las consolas, así que la CPU compite contra los dos. Antes de hacerlo se revisó
   que el final de la carrera no dependa de ese número: `GMDataVS::CanRaceEnd` (0x80536054) recorre a todos los
   jugadores por puesto. Y las huellas lo confirman: la misma carrera en las dos (18 de 18).

Queda además una guarda en `CtrlRaceNameBalloon::UpdatePosition` (no actualiza un globo cuya pantalla no existe) y
`?unaPantalla=0` para ver lo de antes.

### 7. El sitio (`terceros/Paginita-Pro`, solo archivos de Mario Kart)

- `srcMkw`: siempre `modo=sala` con `sincro` (los pilotos en orden), `jefe` (el anfitrión al empezar), la semilla de la
  tanda, el modo, las carreras, la cilindrada y, en la playlist, la cola sorteada. Los nombres no van en la dirección:
  se le mandan al marco por mensaje, igual que el anfitrión nuevo si cambia (el marco ya no se recarga por eso).
- `redMkw`: dos modos (copa por omisión, playlist; una sala vieja de Retro WFC pasa a copa), siempre la carrera
  sincronizada con los primeros 4; si el anfitrión se va, siguen. Caben 4 (`cupo: 4`).
- Vestíbulo, opciones al crear la sala y manual: sin Retro WFC ni «CPU de relleno».

### 8. Probado en la página de Juegos de esta PC (el `jugar.bat`)

**Qué se hizo.** `herramientas/prueba-experiencia.mjs` (la prueba del `jugar.bat`: emuladores de Firebase con las
reglas del sitio, cuentas de mentira, el Worker de verdad) recorría el flujo viejo (sala con CPU, «2 de 12», el juego
llegando solo a la carrera). Ahora recorre la sala nueva como dos personas en dos computadores:

1. Piloto Uno abre la sala (copa) y Piloto Dos entra con el enlace: «2 de 4».
2. «¡A correr!»: el juego de los dos se abre con `modo=sala`, la misma semilla y Piloto Uno de anfitriona.
3. La anfitriona ve el selector de copa de la página y Piloto Dos «El anfitrión está eligiendo la copa…»; el juego de
   los dos ya está en la pantalla de personaje (sección 0x49), sin título ni licencias. La anfitriona arma la copa.
4. Cada uno elige personaje y vehículo con las teclas, dentro del marco del juego (la prueba le da el foco al marco,
   como el clic de una persona).
5. La carrera 1 abre directo en los dos, los dos como jugadores de verdad, cada uno con su pantalla; la misma carrera
   (huellas iguales) y en la foto del marco de cada uno una sola vista.

**Dos cosas que encontró.**

- **El sitio mostraba el vestíbulo viejo** («Retro WFC», «1 de 2», VR): la página carga el **bundle** `juegos-app.js`,
  no `colabtex/src`, y el bundle era el de §72. Se vuelve a armar solo él:
  `npx esbuild src/juegos-main.js --bundle --minify --format=iife --target=es2020 --outfile=../juegos-app.js` (en
  `colabtex/`). No se usa `npm run build` entero: además sella `?v=` en todas las páginas del sitio, cambios que no son
  de Mario Kart.
- **La sala quedaba de 2**: al crearla no había opción de cupo, y entonces el sitio pone el mínimo (`cupoDe`: 2). Un
  tercer amigo no habría podido entrar. Ahora la sala tiene la opción **«Pilotos» (2, 3 o 4; 4 por omisión)** en
  `juegos-main.js`, con su prueba en `mkw.test`.

**Resultado.** 16 de 17 en la primera pasada (solo el «2 de 2»); con el cupo arreglado, `--rapida` **10/10** («2 de
4»). En las fotos: Mario en la pestaña de Piloto Uno, Luigi en la de Piloto Dos, una vista cada una, y el kart del otro
visible en la pista.

### Trampas

- **`InvokeDirectCpu` necesita `abi_bridge.h`**: sin el include, la compilación falló y la prueba corrió con el `.wasm`
  viejo (y "falló" por otra cosa). Leer siempre la cola de la compilación antes que el resultado de la prueba.
- **El selector de la página sale antes de que el juego termine de arrancar**: una prueba que mira la sección del juego
  apenas ve el selector lee −1 (todavía sin secciones).
- **Comparar el avance de los karts tarde no sirve**: el que va derecho choca en la primera curva y a los 20 s los dos
  quedan contra el mismo muro (1,1343 contra 1,1318 vueltas). Se mide a los 3,5 s, con B todavía quieto.
- **El número de carrera del lockstep es "la próxima que empiece"**: `fijarCarrera(n)` en medio de la n−1 no cambia el
  número, pero sí tiene que soltar la espera.
- **Mirar las fotos, no solo los números**: la tabla de pantallas estaba bien y la imagen salía partida; las pruebas
  pasaban. Ahora una comprobación mira la imagen.
- **El escenario que se prepara es el de los menús** (y lo prepara la versión de Retro Rewind): un gancho en la
  función del juego original o antes del final de la de RR no dura.
- **Una prueba del sitio falla en Windows por las barras** (`controles.test`, worms.js con `\` contra `/`): no es de
  Mario Kart, viene de antes.
- **Cambiar `colabtex/src` no cambia el sitio** hasta volver a armar `juegos-app.js` (ver 8). Las pruebas de
  `colabtex/tests` leen `src/` y pasan igual: solo la prueba con el navegador lo nota.
- **Las teclas van a la ventana que tiene el foco**: en el sitio el juego está en un marco; sin darle el foco al marco,
  las teclas de la prueba le llegan a la página de Juegos y el juego no se entera.

### Pruebas

- `prueba-directa` **13/13** (la carrera directo, sin título ni licencias, ni debajo de la carga) y `--elegir` **15/15**.
- `prueba-sincro --directa` **13/13** (dos pestañas: los dos humanos tipo 0 en las dos consolas, cada una con UNA vista
  —la foto lo confirma: costura 2,2 contra un típico de 2,3—, su cámara, huellas iguales 18 de 18, cada kart con lo
  suyo, la que llegó primero esperó a la otra para largar juntas).
- banco `sala-carrera` **23/23** (fases, 45 s con reloj falso, quien recarga se pone al día, cambio de anfitrión,
  sin círculo al reenviar lo elegido, playlist) y `lockstep` **37/37** (dos nuevas: el cambio de carrera con una
  consola atrás).
- `prueba-sala` **20/20** (dos pestañas, la sala entera: selector de copa en la anfitriona y aviso en B, el juego
  directo en la pantalla de personaje, las dos eligen en el juego, la carrera 1 con la pista 1 de la copa, cada una con
  su pantalla y su kart con lo que eligió, huellas iguales, la carrera 2 sola después de los resultados y la misma en
  las dos, la tabla al final, ningún aviso encima de la carrera, una sola vista en cada foto, sin errores de JavaScript).
- Sitio: `mkw.test` **16/16** (con la opción «Pilotos»), `juegos.test` + `mkw-worker.test` 27/27; Juegos entero 977/978
  (la que falla es la de las barras de Windows).
- `prueba-experiencia` (el `jugar.bat` de punta a punta, ver 8): **16/17** antes de arreglar el cupo y `--rapida` **10/10**
  después. Banco entero **26/26** (la prueba vieja de `directo` ahora dice el contrato nuevo: la página pide el salto
  enseguida y el que espera la partida guardada es el juego).

```bash
node banco/correr.mjs sala-carrera lockstep
node web/navegador/prueba-directa.mjs --elegir
node web/navegador/prueba-sincro.mjs --directa --datos=build/web/datos/sincro-directa
node web/navegador/prueba-sala.mjs
node herramientas/prueba-experiencia.mjs
cd terceros/Paginita-Pro/colabtex && node --test tests/mkw.test.cjs
```

## 2026-10-19 · §74 El selector de pistas: la lista que no se esconde, el modo copa con videos y las sugerencias de la playlist

### Qué pidió el dueño (2026-10-19)

Mirando el selector de la sala mandó dos fotos: con la ventana más chica, la **Copa 79 quedaba tapada** por la vista
previa, y el panel «Tu copa» tenía **4 casillas fijas**. Lo que pidió, en sus palabras resumidas:

1. que la lista sea **persistente** (siempre a la vista) y que se vea bien así; **«usa un crítico para esto»**;
2. las vistas previas **van con lag**;
3. **crear y guardar listas** (presets);
4. **más de 4 pistas**: «es un modo lista, no un modo solo 1 copa»;
5. **sonido** al agregar y al quitar una pista;
6. en la playlist, que **los demás puedan sugerir pistas** y que los personajes se elijan **después** de aceptar la
   lista; al terminar cada carrera, ver la playlist un momento con la opción de **agregar más**; si el anfitrión se va,
   **cambiar de anfitrión** solo;
7. «el **modo copa** es simplemente seleccionar una de las copas existentes y jugarla».

Más tarde, viendo el modo copa (los 4 planos blancos): **«esto está mal… se ve feo»**. Pidió pensarlo con un
**crítico externo**: poder recorrer con el mouse **las pistas una por una, con sus cinemáticas y sus planos**, y quizás
**miniaturas**.

### 1. La lista (`lista-pistas.mjs`, sin dibujar nada)

La lógica va aparte para probarla en el banco sin el juego; `interfaz.mjs` la dibuja.

| Pieza | Qué hace |
|---|---|
| `crearLista` | Las pistas en orden (`{copa, fila}`), hasta **32** (el tope de carreras de una copa de VS del juego). `alternar(p)`: un clic agrega al final o quita si ya estaba. Subir, bajar, quitar, vaciar, llenar al azar con semilla (sin repetir). Cada cambio se guarda en el **borrador** del navegador (`mkw.lista`): al volver a abrir, la lista sigue ahí. |
| `crearPresets` | Las **listas guardadas** con nombre (`mkw.listas`, hasta 30; el mismo nombre reemplaza). |
| `crearSonidosLista` | Sonidos hechos con **osciladores de WebAudio**: agregar (660 → 990 Hz, sube), quitar (620 → 410 Hz, baja), «llena» (180 Hz, sordo) y «llegó una sugerencia» (880 → 1320 Hz). Usan la salida de sonido del juego, así respetan el volumen y el silencio de la página. |

**Un jugador con una lista de N pistas:** el piloto escribe en el juego cuántas carreras tiene la copa de VS
(`SectionParams+0x64` = N; SectionParams se lee de SectionMgr 0x809C1E38 → +0x98), en `menus.mjs`. Probado con
`prueba-copa --cinco`: se corren las 5 pistas pedidas, con su semilla, y el número de carrera avanza 1…5.

### 2. El lag de las vistas previas: medido y arreglado

Con la red simulada hasta R2 (50 ms), pasar el mouse por las pistas daba **P90 335 ms y hasta 1,5 s** hasta ver la foto.
La causa: el paquete de fotos (~1 MB cada 48 pistas) recién se pedía al primer paso del mouse, y además competía con
los paquetes de videítos. Lo que se hizo:

- `imagenes.precargar()`: apenas se abre el selector se bajan en fila los paquetes de copas, planos y fotos;
- el videíto se pide recién si el mouse se queda **0,7 s** en una pista (en el modo copa: 250 ms, ver 4);
- los nodos de la vista se arman **una vez** y después solo cambian; una imagen nueva se muestra recién
  **decodificada** (sin parpadeo);
- barrer con el mouse solo muestra la pista que queda debajo **60 ms** (filtro antirrebote).

### 3. La lista siempre a la vista, revisada por un crítico (12 puntos)

Se le dieron a un **crítico de diseño** (otro agente) las fotos del selector en 5 anchos y el código. Lo aplicado:

- **pantalla ancha**: la cabecera con el buscador queda **fija arriba** al desplazar; el costado (390 px) queda quieto
  con la **lista arriba, alta**, y la vista previa como una **franja** abajo (foto + plano de 110 px);
- **colores con regla**: amarillo = lo elegido (las pistas de la lista, con su número), lila = el paso del mouse;
- «Confirmar» es el **botón grande** de la portada; las **listas guardadas** van en un menú, con borrar en **dos
  pasos** («¿Borrar?») y **«Deshacer»** 8 s después de vaciar o de cargar una encima de otra;
- **celular (< 900 px)**: el costado es una **hoja pegada abajo** (plegada: su cabeza y Confirmar); sin vista previa
  flotante en el modo lista (la foto del renglón alcanza); botones de **40 px** o más con el dedo;
- **la Copa 79 tapada**: la grilla deja libre al final el alto de la hoja (lo mide un `ResizeObserver`); con el mouse en
  una ventana angosta, la vista previa va a la **mitad libre** (si la copa señalada está abajo, la vista sale arriba).

### 4. El modo copa nuevo (segunda revisión crítica)

El crítico encontró 8 problemas; los grandes: dos vistas que no se parecían (la de la copa y la de cada pista) y el panel
que saltaba ~150 px; la imagen más grande era la menos linda (las siluetas blancas) mientras el video, que es lo que da
ganas de jugar una copa, no aparecía; ~300 px vacíos; el amarillo usado para el paso del mouse; y **un clic suelto que
elegía la copa de toda la sala** sin querer. Lo hecho:

- **un solo panel de alto fijo**: arriba la copa («Copa 3 · 4 carreras»); al medio el **videíto** de la pista (sobre su
  foto, con fundido de 140 ms), su número «2/4», su nombre y tu mejor tiempo si hay, y el **plano como minimapa** en la
  esquina (al pasar el mouse se agranda al doble); abajo las **4 miniaturas** y el botón amarillo **«Jugar la Copa N»**;
- **pista por pista**: pasar por la copa la muestra y **avanza sola cada 4 s** (con una barrita de avance; se detiene
  con el mouse encima del panel); pasar por una pista de la tarjeta o por una miniatura muestra esa al toque; **← →** o
  **1–4** en el teclado;
- **marcar y confirmar**: un clic marca la copa (anillo amarillo); «Jugar la Copa N», **Enter** o **doble clic** la
  confirman. Al cruzar otras copas camino al botón, el panel vuelve a la marcada al salir de la grilla.
  «🎲 Una al azar» marca una (no la juega);
- **la tarjeta de cada copa** lleva la **tira de sus 4 fotos** (carga perezosa: solo las que se ven) y las pistas
  numeradas como texto;
- **celular**: el panel va **abajo** (el botón queda bajo el pulgar), las 4 miniaturas en 2×2 al lado del video, no pasa
  de ~45 % del alto, y la tarjeta tocada se desplaza para que no quede tapada; deslizar de lado sobre el video cambia
  de pista. Desplazar la grilla ≥ 32 px cierra el panel, salvo con una copa marcada (tiene el botón de jugar);
- con **menos movimiento** o **ahorro de datos**: sin videítos, sin avance solo y sin fundidos.

### 5. Las sugerencias de la playlist (`playlist-sala.mjs` + el selector)

El modelo (sin dibujar ni mandar mensajes): la lista del anfitrión y las sugerencias `{id, de, copa, fila, estado}`.
Reglas: no se sugiere una pista que ya está en la lista ni una que ya espera respuesta; hasta **8 pendientes por
persona**; con la lista llena (32) no se sugiere más; si el anfitrión agrega por su cuenta una sugerida, cuenta como
aceptada; se guardan las últimas 40 respondidas para que cada uno vea cómo le fue. El estado entero se **exporta** y
viaja dentro del estado de la sala: el anfitrión nuevo lo **importa** y sigue numerando sin chocar; lo raro que llegue
por la red se descarta.

En el selector:

- **el anfitrión** (modo lista con `sugerencias: true`): un panel «Sugerencias» con la foto, el nombre, quién la sugirió
  y **✓** (entra al final de la lista) / **✕**; un chip **«💬 N»** en la cabeza de la lista (se ve aunque la hoja esté
  plegada en el celular); un «ding» cuando llega una nueva; en la grilla las sugeridas llevan 💬;
- **los demás** (modo **sugerir**): la misma grilla, pero un clic **sugiere**; al costado, la **lista de la sala** (solo
  para ver, se actualiza sola) y **«Tus sugerencias»** con ⌛ Esperando / ✓ En la lista / ✕ No entró (con sonido cuando
  cambia); el selector lo cierra la sala cuando el anfitrión confirma, o «Listo» entre carrera y carrera.

### 6. El sitio

La sala del sitio ya no pregunta «Carreras»: la **copa** es una copa del juego (siempre 4 carreras) y la **playlist** una
lista de hasta 32 que se arma en el juego con las sugerencias de todos (`colabtex/src/juegos/mkw.js`, textos del
vestíbulo, del menú de crear sala y del manual). Pruebas del sitio: `mkw.test` + `juegos.test` **37/37**.

### 7. Conectado en la sala (`sala-carrera.mjs` y `mkw.mjs`)

Cuando la sesión de §75 terminó con esos archivos, el selector nuevo entró a la sala:

- **Copa**: el anfitrión ve el **modo copa** («Elige la copa de la sala»); al confirmar, la sala corre las 4 pistas de
  esa copa. Si la copa se fija sin el selector (un anfitrión nuevo, las pruebas), el selector se cierra solo.
- **Playlist, al empezar** (la fase «copa» del árbitro): el anfitrión arma la lista en el **modo lista con
  sugerencias** (con su propio borrador, `mkw.lista.sala`); cada cambio va al estado de la sala (`listaCambio`) y los
  demás lo ven en su **modo sugerir**. Una sugerencia viaja como `{t:'sugiero', copa, fila}`; el anfitrión la pasa por las
  reglas de `playlist-sala.mjs` y la deja en el estado (`estado.lista`). Recién cuando el anfitrión **confirma**, la
  sala pasa a elegir personaje (el selector de los demás se cierra solo).
- **Playlist, entre carrera y carrera**: mientras se ven los resultados aparece al costado el **panel de la playlist**
  (`playlistBreve`): las que vienen, «N de M corridas» y «+ Agregar pistas» (el anfitrión) o «Sugerir pista» (los demás).
  «+ Agregar pistas» abre el selector con **solo las que vienen** (las corridas y la que se acaba de correr no se tocan:
  `restantesCambio`) y **pausa** la sala: los resultados esperan hasta 60 s; al cerrarlo, 3 s más y la carrera siguiente.
  Las sugerencias aceptadas durante la copa entran al final y alargan la copa (`carreras` crece); si el anfitrión deja
  la lista sin pistas por delante, la copa termina con la carrera que se corrió.
- **Anfitrión nuevo**: la lista y las sugerencias van dentro del estado que se reparte cada segundo, así que el nuevo ya
  las tiene; si estaba sugiriendo, su selector de sugerir se cierra y se le abre el de armar.
- Un jugador: el aviso de la copa a tu gusto dice «carrera n de N» (antes, siempre «de 4»).

### Trampas

- **La hoja de abajo quedó en alto cero**: la lista tenía `flex: 1 1 0` (crecer desde cero), y dentro de un contenedor
  cuyo alto lo pone el contenido, «desde cero» es cero. En la hoja va `flex: 0 1 auto`.
- **Una clase con el mismo nombre** (`.fila`) ya la usaba el panel de los mandos: los renglones de la lista pasaron a
  llamarse `renglon`.
- **Enter después de «Una al azar»** volvía a apretar ese botón (el foco queda en él) y marcaba otra copa: ahí Enter
  juega la marcada.
- **Un salto de desplazamiento grande no cerraba la vista**: el primer aviso de desplazamiento solo anotaba desde
  dónde contar. Ahora se cuenta desde que la vista se abre.
- **La pista resaltada de la copa anterior** quedaba marcada al cambiar de copa: se limpia al cambiar.

### Pruebas

- banco `lista-pistas` **43/43** (agregar/quitar, 32 como tope, sorteo con semilla, borrador, presets, los cuatro
  sonidos y el silencio) y `playlist-sala` **25/25** (sugerir, reglas, aceptar, rechazar, lista llena, exportar e
  importar como al cambiar de anfitrión, datos raros, las respondidas viejas).
- banco `sala-playlist` **33/33** (la playlist del árbitro: empieza armando la lista, sugerir y sus reglas, solo el
  anfitrión cambia y acepta, recién al confirmar se elige, alargar la copa durante la carrera, «+ Agregar pistas» pausa
  los resultados y tiene tope de 60 s, las corridas no se tocan, el anfitrión nuevo sigue con todo, sin pistas por
  delante termina, la copa normal no tiene lista), `sala-carrera` **46/46** y el banco entero **29/29**.
- `prueba-elegir` **65/65**: el modo copa nuevo (14: panel nunca vacío, tira de fotos en cada tarjeta, pista por pista
  con el mouse y con →, el videíto, marcar sin jugar, volver a la marcada, «Jugar la Copa 4», avance solo a los 4 s,
  «Una al azar» + Enter, doble clic), el modo lista (17), las sugerencias (15: el anfitrión acepta y rechaza, el
  «ding», quien sugiere ve la lista sin poder cambiarla, ⌛ → ✓ con sonido) y el panel de entre carreras (6).
- `prueba-playlist` **17/17** (nueva, el juego en dos pestañas): A arma y B sugiere, lo de A le aparece a B, la
  sugerencia llega con «💬 1» y A la acepta, recién al confirmar se elige personaje, la carrera 1 con la pista 1, el
  panel en las dos al terminarla, B sugiere desde ahí, A agrega mientras la sala espera (pasados los 9 s de
  resultados), la carrera 2 con la pista que venía y la playlist con 3 en las dos, sin errores.
- `prueba-sala` **25/25** (la copa, dos pestañas): el selector de copas en la anfitriona, que se cierra solo; el resto
  igual que en §75 (y la regla «DNF» de §77).
- `prueba-copa --cinco` **13/13** (un jugador, lista de 5: las 5 carreras con la pista y la semilla pedidas, 11,7 min).
- Fotos del selector en 1280, 1000×650, 820, 700 y 390 px: la última copa nunca queda tapada (medido).

```bash
node banco/correr.mjs lista-pistas playlist-sala sala-playlist sala-carrera
node web/navegador/prueba-elegir.mjs
node web/navegador/prueba-copa.mjs --cinco
node web/navegador/prueba-playlist.mjs
node web/navegador/prueba-sala.mjs
```

### Lo que falta

- ~~Pasar todo esto a la copia del juego que lleva el sitio (`subir-kit`) y probarlo en la página de Juegos de esta PC
  (`prueba-experiencia`, que ya usa «Una al azar» + «Jugar la Copa N»).~~ Hecho en §79.4 y §79.5 (17/17).
- La prueba de dos pestañas no prueba el cambio de anfitrión con la playlist a medio armar (lo prueba el banco
  `sala-playlist`, sin el juego).

## 2026-10-19 · §75 Volver a la sala tras recargar, la carrera que termina sola y la copa con sus puntos

### Qué pidió el dueño (2026-10-19)

1. **Volver tras recargar (M11)**: si alguien recarga la página (o se le corta la red) a mitad de la copa, que vuelva
   a la sala, a SU puesto y con lo que había elegido, sin desordenar la carrera de los demás.
2. **La copa entera con los puntos de verdad**: que la tabla del final sume lo que el juego dio en cada carrera.
3. Un **error grave** que vio probando: «no se está terminando la carrera si hay un jugador que no la ha terminado;
   debiera terminar igual que en el juego normal, bajo las mismas normas, pero que no lo eche de la sala si está
   quieto». (Lo de no echarlo ya estaba: el control de inactividad del juego sigue apagado, §72.)

(Este trabajo es §75 y no §74 porque otra sesión, a la vez, usa §74 para el selector de pistas en modo lista.)

### La idea en una línea

Cada página da un **latido** cada segundo; con eso la anfitriona sabe quién está y escribe en el estado, al empezar
cada carrera, **quién queda fuera** (el **plantel**): todas las consolas corren esa carrera con la misma lista. Quien
recargó **se salta** la carrera en curso (lo avisa en su latido, así nadie lo espera 30 s) y entra en la siguiente. La
carrera **termina sola** con el **tiempo límite** del modo en línea del juego, y los **puntos** los suma el juego una
vez por carrera, en el mismo cuadro en todas las consolas.

### 1. Volver tras recargar: el árbitro de la sala (`sala-carrera.mjs`)

Antes, una página recién cargada arrancaba su árbitro "en cero" (fase copa, estado número 0) y lo mostraba enseguida:
si la copa ya iba por la carrera 2, durante un segundo creía que la sala recién empezaba, y esa "primera vista" la
gastaba en una sala falsa. Peor: si la que recargaba era la anfitriona, su sala nueva **mandaba** sobre las de los
demás. Ahora:

- **Latido** (`{t:'aqui', v, salta}`): cada página manda cada 1 s «sigo aquí, tengo el estado número `v`, me salto la
  carrera `salta`». Cada mensaje que llega anota a su autor en `vistos` (con la hora).
- **Sala lista**: la página no muestra nada (ni llama `alCambiar`) hasta saber en qué va la sala. Los demás, con el
  primer reparto de la anfitriona; la anfitriona, cuando ya oyó a todos (mínimo 2 s, máximo 8 s:
  `ESPERA_COPIA_MS`, `ESPERA_TODOS_MS`). Mientras tanto la página dice «Conectando con la sala…».
- **Copia del estado** (`dame` / `copia`): si la anfitriona recargó, los latidos de los demás traen un número de estado
  más alto que el suyo (0): les pide la copia, la adopta y sigue desde ahí con un número más alto que todos.
- **Plantel** (`fuera`): al empezar cada carrera la anfitriona escribe en el estado los humanos que no dieron latido en
  los últimos 10 s (`PRESENTE_MS`). Para esa carrera van "sin nadie" en todas las consolas.
- **Saltarse la carrera** (`saltar(n)`): quien recargó y ve que la sala ya está en la carrera `n` no entra (su consola
  no tiene los cuadros que ya pasaron: se desincronizaría); lo dice en su latido y entra en la siguiente, con su
  puesto y lo que había elegido (están en el estado de la sala: `picks`).

### 2. La carrera sincronizada con plantel (`lockstep.mjs`)

- `fijarCarrera(k, fuera)`: los mandos de `fuera` quedan **cortados desde el cuadro 0** de la carrera `k`, en todas
  las consolas igual; los demás corren aunque se hubieran cortado en la anterior (sin plantel, como antes: los cortes
  pasan de una carrera a la otra).
- **Quién decide** (el que anuncia el retraso y propone los cortes) sale del plantel: el primer humano que corre esa
  carrera (`decisorDe(k)`). Antes era "el primero de la lista", que podía ser justo el que no estaba.
- `saltar(mando, k)`: con el aviso del latido, el corte de quien se fue se propone **enseguida** (~1 s) en vez de
  esperarlo 30 s (`esperaCorte`).
- `enCuadro(k, cuadro, fn)`: una acción en el MISMO cuadro de la carrera en todas las consolas (la usan las pruebas).

### 3. La carrera que termina sola: el tiempo límite del juego (`lockstep_nativo.cpp`)

**Por qué no terminaba.** Nuestras salas corren la carrera como una VS "local" del juego (`GMDataVS`), que espera a
que **todos** los humanos crucen la meta. Si uno se queda quieto, la carrera no termina nunca. El modo **en línea** del
juego tiene una regla para eso: `GMDataOnlineVS::Update` (0x8053F2A4) mira el reloj de la carrera y, cuando pasa del
**límite** (5:00 en el juego original; Retro Rewind lo cambia por el número que guarda en 0x818759B0 —en esta versión
está en 0, así que vale el del juego—), a cada piloto que no cruzó la meta le termina la carrera con un **tiempo
estimado** por lo que avanzó (0x805342E8 con 4 y 1). Su puesto es el que tenía en la pista.

**Lo que hicimos.** Envolvemos `Raceinfo::Update` (la versión de RR, `rr_overlay_805331B4`, en `REEMPLAZOS` de
`compilar-web.py`) y, en la sala, hacemos lo mismo con los humanos: el reloj de la carrera es parte de la simulación,
así que el límite pasa en el MISMO cuadro en todas las consolas. Nadie sale de la sala: solo termina SU carrera.
- `?limite=N` (segundos) = otro límite, solo para pruebas (esperar 5 minutos de carrera no da).
- `window.mkwLimiteCarrera()` = el límite que usa el juego, en ms (para mirar).

### 4. Terminar la carrera por código, en las pruebas (`mkwTerminarEn`)

En la prueba nadie maneja, y una carrera entera son minutos. `window.mkwTerminarEn(cuadro, carrera, puestos)` pide, con
`enCuadro`, que en ese cuadro el juego corra `RaceinfoPlayer::EndLap` (0x805349B8, la función que corre al cruzar la
meta) hasta pasar la última vuelta de esos humanos. Lo demás (el puesto, el tiempo, el fin, los puntos) lo hace el
juego como siempre. `puestos = [0]` = solo llega A (así se prueba el tiempo límite con B quieto).

### 5. Los puntos de la copa, una vez por carrera

**Por qué faltaban.** Racedata tiene dos fichas de la carrera: la de los **menús** (+0xC10) y la de la **carrera** en
curso (+0x20, una copia que se hace al empezar). El juego suma los puntos (`RacedataScenario::UpdatePoints`,
0x8052E950) en la de los menús, y recién cuando la **pantalla de resultados** llena su tabla
(`GPVSLeaderboardUpdate::FillRows`, 0x8085C858). En la sala esa pantalla puede no llegar a llenarse (la carrera
siguiente abre directo; o quien recargó se la saltó), y la tabla de la copa salía con los puntos de **una** carrera
(73 en vez de 146).

**Lo que hicimos.** En la sala, en el primer cuadro con la carrera terminada (etapa 4 o más: los puestos ya son los
finales), llamamos nosotros a `UpdatePoints` sobre la ficha de los menús, igual que la pantalla de resultados. Y una
envoltura de `UpdatePoints` hace que, en esa misma carrera, las llamadas de las tablas no sumen otra vez (una bandera
que se baja cuando corre una carrera nueva). Así los puntos se suman una vez, en el mismo cuadro en todas las
consolas, se vea o no la pantalla de resultados. La tabla de la copa (`tablaDelJuego`) los lee de la ficha de los menús.
(Tiene que ser una sola vez: la misma función también suma el VR/BR del jugador, `RKSYS::Rating::AddPoints`, y eso sí
se acumularía.)

**Y la segunda carrera sumaba desde cero.** Con eso la carrera 1 ya daba 73, pero la tabla final traía solo la última
carrera (A 15, B 0). Leyendo `UpdatePoints`: cada jugador tiene dos números, **los puntos de antes de esta carrera**
(+0xD8) y **el total** (+0xDA), y la función hace total = de antes + los de esta carrera. El "de antes" lo pone el
menú del juego que lleva a la carrera siguiente, que en la sala no pasa (abrimos cada carrera directo). Arreglo en
`escribirFicha` (`directo_nativo.cpp`): en cada carrera que no es la primera, "de antes" = el total que lleva. Como en
un medidor de energía con lectura anterior y lectura actual: si nadie anota la lectura anterior al cerrar el período,
el consumo del período siguiente se calcula contra cero.

**Y quien recargó no tiene los puntos de las carreras que se saltó.** Con lo anterior la copa ya sumaba bien en las
consolas que corrieron todo; pero en la prueba con recarga la tabla de B (que se saltó la carrera 1) traía solo la 2,
distinta de la de A. Arreglo en la sala: al terminar cada carrera cada página manda, con su aviso, los 12 puntos que
lleva su consola y **desde qué carrera corrió** (`termine(n, puntos, desde)`). La anfitriona deja en el estado
`puntos: {carrera, tabla, desde}` con la tabla de quien corrió desde más atrás (todas las que corrieron todo tienen la
misma: es la misma carrera). Cada consola, al abrir la carrera siguiente, escribe esa tabla en su juego
(`ponerPuntos`: +0xDA de cada puesto, en dos bytes con el más alto primero, como guarda los números la Wii) antes de
la ficha, y la tabla final sale de ahí. Así quien volvió termina la copa con los mismos puntos que los demás.

### 6. La página (`mkw.mjs`, solo el bloque de la sala)

- Al abrir cada carrera (desde la 2): los puntos de la sala en el juego (`ponerPuntos`); al terminarla, el aviso
  lleva los puntos de esta consola y desde qué carrera corrió; la tabla del final, la de la sala.

- La página no mira el estado inicial de su árbitro (era el de una sala nueva): espera a que la sala esté lista
  («Conectando con la sala…»).
- Si la primera vista ya es una carrera, o la anfitriona la dejó fuera de esa carrera: «La copa ya empezó: entras en la
  carrera siguiente…» (o «…al final verás la tabla», si es la última), y se salta esa carrera.
- `alSalta`: el latido de otro dice que se salta la carrera `k` → `lockstep.saltar(su mando, k)`.

### Trampas

- **La "primera vista" se gastaba en la sala falsa**: la llamada `alCambiarSala(sala.estado())` al armar la página
  usaba el estado inicial (copa, número 0). Quien recargaba en la carrera 2 entraba a la carrera en curso desde el
  cuadro 0, desincronizado. Ahora la sala avisa recién cuando sabe en qué va.
- **Los puntos son "de antes + de esta"**: sin el "de antes" la copa suma solo la última carrera (ver 5).
- **Los puntos están en la ficha de los menús**, no en la de la carrera: la de la carrera se queda con los de antes de
  empezar. Y llegan cuando los suma la pantalla de resultados (de ahí el arreglo de 5).
- **Mensajes viejos en el banco**: una sección del banco dejaba mensajes en camino que le llegaban a la página nueva de
  la siguiente (y la hacían pedir una copia). Ahora se vacían los relojes antes de empezar otra.
- **La vigía de la página puede ver el fin un cuadro antes que los puntos**: cuando el tiempo límite termina la carrera,
  la etapa pasa a 4 al final de ese cuadro y los puntos se suman en el siguiente. La página mira cada 0,5 s: si mira
  justo entre los dos, manda la tabla de antes, y como la anfitriona se queda con la primera (con el mismo "desde"),
  la copa salía con 73. Ahora la página espera a que el juego diga que ya los sumó (`mkw_sala_puntos_sumados`).
- **Dos compilaciones a la vez congelan las pruebas**: mientras otra sesión enlazaba su `.wasm`, las dos pestañas se
  quedaron 20 a 45 s sin dar un cuadro; la carrera sincronizada cortó a la que no respondía (lo que tiene que hacer) y
  la prueba salió mal. Repetida sin la otra compilación, bien. Se coordina: una compilación a la vez, y las pruebas con
  el juego no mientras otra compila.
- **El reloj de la carrera se lee en cada pestaña en su momento**: 45195 contra 45211 ms (un cuadro). La prueba pide
  que difieran menos de 0,5 s; que la carrera fue la misma lo dice la tabla, igual en las dos.
- **El selector de pistas cambia a la vez** (la otra sesión, §74: modo lista): `prueba-sala` ya no aprieta sus casillas;
  fija la copa con `mkwSala.ponerPistas` (lo mismo que hace el selector al confirmar) y cierra el selector con Escape.

### 7. El detector de pantalla partida, sin falsos positivos (`foto-pantalla.mjs`)

Dos veces la prueba dijo «pantalla partida» con una sola vista en la foto: en la largada, la raya del globo con el
nombre del otro piloto («Piloto») cae justo en la fila del medio y salta mucho. Pero una costura de verdad cruza toda
la imagen y esa raya no: ahora el detector mide también el **ancho** del salto (qué parte de las columnas cambia de
golpe en esa fila) y pide más de 0,3. Calibrado con las fotos de las pruebas (una vista: la raya del globo da 0,16) y
con pantallas partidas armadas juntando dos fotos de verdad (0,43 a 1).

### Pruebas

- Banco `sala-carrera` **46/46** (nuevas: la sala no se muestra hasta estar lista; Caro que no llega queda `fuera` y
  vuelve en la siguiente; la anfitriona que recarga adopta la copia; los puntos de la sala, que se quedan con la tabla
  de quien corrió desde más atrás) y `lockstep` **42/42** (nuevas: quien se va avisando se corta en ~1 s; el plantel
  de la carrera, igual en las consolas aunque una recién llegue; `enCuadro`). Banco entero **28/28**.
- `prueba-sincro --directa` **13/13** (la carrera de dos pestañas sigue igual).
- `prueba-sala` (la copa entera de 2 carreras): **25/25**. La carrera 1 la terminan los dos en el mismo cuadro
  (73 puntos, iguales en las dos); en la 2 llega solo A y B se queda quieto: termina sola al pasar el límite (45 s de
  prueba: 45211 y 45295 ms leídos en cada pestaña) y la tabla suma 146 (A 12 + 15 = 27, B 15 + 0 = 15), la misma en
  las dos. (Antes de los arreglos: la carrera 2 no terminaba nunca y la tabla daba 73.)
- `prueba-sala --recarga` **27/28**: B recarga a mitad de la carrera 1, A sigue en pocos segundos, B ve «La copa ya
  empezó: entras en la carrera siguiente…», A termina la 1 sola, B vuelve en la 2 en su puesto, con lo que eligió, su
  pantalla y sus botones, la misma carrera en las dos, y la tabla es la misma en las dos (146). La que falló: «ningún
  aviso encima de la carrera»: B mostraba «Se cortó la conexión con jugador 1: lo esperamos 27 s» porque A no dio
  cuadros 2 a 4 s seguidos (el PC estaba ocupado con otra prueba y una compilación de otra sesión).

```bash
node banco/correr.mjs sala-carrera lockstep
node web/navegador/prueba-sala.mjs
node web/navegador/prueba-sala.mjs --recarga
node web/navegador/prueba-sincro.mjs --directa --datos=build/web/datos/sincro-directa
node banco/correr.mjs
```

## 2026-10-19 · §76 La música bajo el menú JloKart, que tardaba en sonar

### Qué pidió el dueño (2026-10-19)

«En el menú de inicio de JloKart demora en iniciar la música unos segundos». Esa música es la del **título del juego**,
que arranca debajo del menú de la página. Se pidió reducir ese tiempo, nada más.

### Qué se midió (antes)

Con la latencia del sitio (`MKW_LATENCIA=50`, como R2 detrás del Worker): el menú aparece a los 0,2 s, pero la música
sonaba a los **8,5–9,1 s** en la 1.ª visita y a los **5,5–6,1 s** con caché. Se probó qué atrasaba al juego hasta su
título: no era la pantalla de la correa (StrapScene, la del aviso de la correa del Wiimote: se la midió y pasa en
segundos fijos que no cambian), sino **el precalentado de los ~700 pipelines** al arrancar: el proceso de la GPU del
navegador quedaba ocupado 3–4 s y el juego no avanzaba hasta su título. En la 1.ª visita, además, el juego leía su
arranque del disco bloque por bloque, cada uno con su espera de red.

### Qué se hizo

1. **Precalentado postergado** (`aurora-main/lib/gfx/pipeline_cache.cpp`, en `parches/aurora-web.diff`): con la
   variable `MKW_PRECALENTAR=tarde[:N[:M]]`, aurora guarda la lista y no la pide hasta que la página llama a la
   función nueva `_mkw_web_pipelines_precalentar` (exportada en `herramientas/compilar-web.py`). Después la pide de a
   N por cuadro (2) con M compilándose como mucho (4), contando los del propio juego. Sin la variable, todo igual.
2. **La página** (`web/navegador/mkw.mjs`): pone la variable solo con el menú de inicio y **solo si este navegador ya
   jugó antes** (marca `mkw.precalentado`, que se guarda 20 s después de llegar al título); llama a la función cuando
   el juego llega a su primera pantalla (o a los 30 s). `?precalentarTarde=1/0` lo fuerza o lo apaga.
3. **Semilla del arranque** (`mkw.mjs`, `adelantarArranque`): los bloques de `bloques.json` que el juego lee antes
   del cuadro 450 se piden todos al abrir (por `disco.adelantarRango`). `?semillaArranque=0` lo apaga.
4. **Carpeta en racha** (`web/navegador/disco.mjs`, `vecinos`/`adelantarCarpeta`): los fantasmas del menú «Un
   jugador» llegan por carpeta. `?vecinos=0` lo apaga. Banco `disco`: **33/33** (con la parte g nueva, 6 puntos:
   64 fantasmas = 4 esperas en vez de 32, de 995 ms a 254 ms).

### Resultado

| Del menú a la música | Antes | Ahora |
|---|---|---|
| 1.ª visita (sin caché) | 8,6 s | **5,5 s** (la semilla del arranque) |
| Con caché (visitas siguientes) | 5,2–5,4 s | **3,2 s** (el precalentado postergado) |
| Single Player → música del menú «Un jugador» | 2,1 s | 2,1 s (igual; los fantasmas por carpeta no lo cambian aquí) |

`prueba-musica --comparar`: **11/11** (2026-10-19 20:34), sin cortes de música en ninguna visita. La espera que oye
el dueño baja unos 3 s en la 1.ª visita y unos 2 s en las siguientes. Lo que queda (~3 s con caché) es lo que el juego
tarda en cargar su título; bajarlo más exigiría tocar la carga del juego, y el dueño pidió parar aquí.

### Trampas

- **En la 1.ª visita no se puede postergar**: sin la caché de shaders, compilar los ~700 con la música sonando trababa
  el juego (cuadros de hasta 854 ms) y la música se cortaba. Por eso la marca de "ya jugó".
- **Medir con otras pruebas corriendo engaña**: si otra sesión corre una prueba con el juego o compila, los tiempos se
  duplican. Antes de medir, ver que no haya otros Chrome/compiladores ocupando la CPU.
- **Perfiles de Chrome en rutas largas**: con la carpeta de prueba dentro de una ruta larga, Windows (límite de 260
  letras) rompe el almacenamiento de caché de Chrome («UnknownError»). Los perfiles van en la carpeta temporal.
- **La cola de la música del título** suena todavía al entrar al menú «Un jugador»: la prueba cuenta la música nueva
  recién cuando la página 0x69 de ese menú está activa.
- El `.wasm` principal (`build/web/navegador`) necesita **volver a enlazarse** para tener la función nueva; mientras
  tanto la página no la encuentra y sigue con el precalentado al arrancar (no se rompe nada).

### Pruebas

```bash
node banco/correr.mjs disco
node web/navegador/prueba-musica.mjs --comparar
```


## 2026-10-19 · §77 El reloj de los que faltan: 30 s después de que llega el primero («DNF»)

### Qué pidió el dueño (2026-10-19)

Aplicar la regla de las carreras en línea de Mario Kart 8 (el «temporizador DNF»): el reloj empieza en el instante en
que el primero cruza la meta; los demás tienen 30 s; si no llegan, la carrera se da por terminada y quedan en el puesto
en que iban. Hasta §75 la carrera de la sala terminaba sola solo con el tiempo límite (5:00): un humano quieto hacía
esperar a los demás casi 5 minutos.

### Lo que hicimos

En `lockstep_nativo.cpp`, dentro de la misma envoltura de `Raceinfo::Update` de §75 (la parte (4)):

- En cada cuadro de la carrera, mientras nadie llegó, se mira si algún humano de la sala cruzó la meta
  (RaceinfoPlayer +0x38, bit 0x2). En el primer cuadro en que pasa, se anota el **reloj de la carrera** de ese cuadro.
- Cuando el reloj de la carrera pasa de ese momento + 30 s, a cada humano que todavía no llegó se le termina la
  carrera con la misma función que usa el tiempo límite del juego en línea (0x805342E8 con 4 y 1: un tiempo estimado
  por lo que avanzó, y el puesto el que tenía en la pista). Con todos los humanos llegados, el juego da la carrera por
  terminada (§73: `CanRaceEnd`) y la sala sigue con los resultados.
- Al empezar cada carrera (etapa menor que 2) el reloj se borra.
- El tiempo límite de 5:00 sigue: vale si ningún humano llega en 5 minutos.

**Decisión (cambiada en §78, a pedido del dueño: ahora lo dispara el primer corredor, humano o CPU): lo dispara el primer HUMANO, no una CPU.** La regla está para que los que ya terminaron no esperen; si solo
llegaron CPU, no está esperando nadie, y con las CPU de relleno un humano lento quedaría cortado a los 30 s de la CPU
ganadora sin que nadie lo esté esperando.

**Por qué en el juego y no en la página:** el reloj de la carrera es parte de la simulación (reloj fijo de la carrera
sincronizada), así que el plazo vence en el MISMO cuadro en todas las consolas, y nadie tiene que avisar nada por la red.

Para mirar o probar: `Module._mkw_sala_dnf(ms)` = otro plazo (0 = 30 s); `mkw_sala_dnf_desde()` = el reloj de la carrera
cuando llegó el primero (−1 = todavía nadie).

### La prueba (`prueba-sala.mjs`)

En la carrera 2 llega solo A (por código, `mkwTerminarEn` con el puesto 0) y B se queda quieto. La prueba anota el
reloj de la carrera cuando A cruza la meta (mira cada 0,5 s el bit 0x2 de los dos: el campo nuevo `llegaron`) y pide
que la carrera termine entre 29 y 31,5 s después, antes del tiempo límite (que en la prueba ahora es de 120 s, para que
no se confunda con el de antes), en las dos pestañas, con B llegado (por el juego) y la tabla con 146 puntos.

### Trampas

- **La sala tiene dos sesiones trabajando a la vez**: los archivos de la sala (`sala-carrera.mjs`, el bloque de la sala
  de `mkw.mjs`, `prueba-sala.mjs`, el banco `sala-carrera`) pasaron a la sesión del selector de pistas (§74). Para §77
  se tocó solo el juego (`lockstep_nativo.cpp`) y, avisando antes, dos partes de `prueba-sala.mjs` (`leer` y el final),
  conservando lo que esa sesión había cambiado.
- **Una compilación congela las pruebas de la otra sesión**: hay que avisarse antes de compilar.
- **La vigía de fin de carrera veía el fin de la carrera ANTERIOR** (venía de §73; lo destapó la tabla de §75): cuando
  la anfitriona pasa a «correr n», la consola todavía está mostrando los resultados de la n−1 (la misma sección de
  carrera, el Raceinfo viejo con la etapa ≥ 4 y los puntos ya sumados). La vigía de la página mira cada 0,5 s; si
  miraba antes de que se abriera la carrera nueva, avisaba «terminé la n» con la tabla vieja. Consecuencia: la tabla
  final salía con 73 (las dos veces que falló), y en una copa de 4 la anfitriona habría saltado a la carrera siguiente
  9 s después de empezar la n. Depende del tiempo (más con el PC cargado), por eso a veces pasaba. Arreglo en
  `mkw.mjs` (avisando a la sesión dueña de ese bloque): la vigía recién acepta la etapa ≥ 4 después de haber visto ESTA
  carrera corriendo (etapa menor que 4). Como un relé con enclavamiento: no puede dar «fin» sin haber pasado antes por
  «en marcha».

### Pruebas

- `prueba-sala` **25/25** (dos pestañas, la copa de 2): en la carrera 2 A llega con el reloj de la carrera en 4,0 s y B,
  quieto, termina por el juego con el reloj en 34,0 s (A) / 34,1 s (B): **30,0 s después**, en las dos, mucho antes
  del tiempo límite (120 s en la prueba). La tabla suma 146 (A 12 + 15 = 27, B 15 + 0 = 15), la misma en las dos.
  La sesión del selector la corrió también con este juego: 25/25 (30,1 s).
- Antes del arreglo de la vigía: 24/25, con la regla DNF bien (30,2 s) pero la tabla final con 73.

```bash
python herramientas/compilar-web.py --modo navegador
node web/navegador/prueba-sala.mjs
```

## 2026-10-19 · §78 El contador de los que faltan, con los números de la cuenta de salida

### Qué pidió el dueño (2026-10-19, cuatro mensajes seguidos)

1. «¿Puedes lanzar algún tipo de aviso de que le quedan 30 s o algo así para ponerle presión con un contador?»
2. «No debiera ser el primer humano, debiera ser el primer corredor aunque no sea humano.»
3. «No me gusta el estilo del temporizador, no se parece al del juego; usa un crítico para arreglar esto.»
4. «¿Puedes utilizar los mismos números del countdown cuando inicia la carrera?»

### 1. El plazo empieza con el primer corredor, humano o CPU (`lockstep_nativo.cpp`)

En §77 el reloj de 30 s («DNF») arrancaba cuando cruzaba la meta el primer **humano**. Ahora arranca con el primer
**corredor**: se miran los N primeros de la lista de Raceinfo (N = cuántos corren, Racedata → escenario de la carrera
+0x4) y el primero que tiene el bit 0x2 («cruzó la meta», RaceinfoPlayer +0x38) anota el reloj de la carrera. Al
vencer, como antes, el juego termina la carrera de cada **humano** que falta (en el puesto en que va, con un tiempo
estimado); las CPU las termina el juego solo, cuando ya no queda ningún humano corriendo. Consecuencia: si una CPU
gana, los humanos tienen 30 s desde ese momento. Sigue corriendo sobre el reloj de la carrera, así que vence en el
mismo cuadro en todas las consolas.

### 2. El contador (`web/navegador/dnf.mjs`)

Cuando el plazo está corriendo, la página lo muestra en grande sobre la imagen del juego:

- A quien **todavía corre**: los segundos que quedan y un letrero: «¡LLEGÓ EL 1.º!» los primeros 2 s, después
  «¡A LA META!». En los últimos 10, cada número entra como en la cuenta de salida (ver 3); en los últimos 5 suena un
  pitido corto por segundo (WebAudio, 880 Hz; el último 1320 Hz y más largo).
- A quien **ya llegó**: un número chico y blanco con «ESPERANDO A LOS DEMÁS», sin pitidos.
- Lee todo del juego en cada refresco de la pantalla: cuándo llegó el primero (`_mkw_sala_dnf_desde()`), el reloj de
  la carrera (Raceinfo +0x14) y si yo ya llegué (mi puesto, Racedata +0x20+0xB64 → mi RaceinfoPlayer, bit 0x2). Cuenta
  en **tiempo de la carrera**: si la carrera se frena esperando a una consola lenta, el contador también; lo que
  muestra es exactamente cuándo va a vencer el plazo de verdad. Como el display de un temporizador conectado al mismo
  reloj que dispara el relé.
- La página le pasa al juego el mismo plazo (`M._mkw_sala_dnf(DNF_MS)`, 30 000 ms), para que los dos digan lo mismo.
- Va en una caja del tamaño exacto de la **imagen 16:9 del juego**, no de la ventana: el canvas se muestra con
  `object-fit: contain` y, desde §79, el juego dibuja su imagen 16:9 al centro del canvas aunque el canvas tenga otra
  forma; la página calcula ese rectángulo (`colocar()`). Así los tamaños en `cqh` son proporcionales a lo que se ve.
- `?cuentaDnf=0` = sin contador (el plazo del juego sigue igual).

### 3. Los números de la cuenta de salida, sacados del mismo juego

**Mirar la cuenta de verdad.** Con una carrera directa (`?modo=directa`) se sacaron fotos cada ~120 ms mientras
Raceinfo +0x28 valía 1 (la cuenta). El «3, 2, 1» es naranja con un borde oliva oscuro, de ~11 % del alto de la imagen,
justo arriba del kart; cada número entra como una silueta blanca que se achica hasta su tamaño y se vuelve naranja.

**De dónde salen.** Con los formatos públicos (Tockdom) se abrieron `Race.szs` y `Font.szs`, solo para leer, en esta PC:

- `go.brlyt` (la pantalla de la cuenta) escribe «3», «2», «1», «GO!» como **texto** con la fuente
  `tt_kart_font_rodan_ntlg_pro_b`, y esa fuente **solo trae `!`, `1`, `2`, `3` y las letras de «GO»**: no hay 0 ni
  del 4 al 9. Así que «30», «29»… no se pueden escribir con ella.
- La fuente de los menús, `kart_kanji_font`, es **la misma letra** (Rodin, con el mismo tipo de borde) y trae todo:
  0–9, mayúsculas, «¡», «Ó», «º», «…».
- **Decisión:** el **3, el 2 y el 1** (los últimos 3 s) salen de la fuente de la cuenta: son literalmente los de la
  salida. Los demás números y los letreros, de `kart_kanji_font`. Las dos se recortan a las filas con tinta para que
  queden del mismo alto en pantalla.
- Retro Rewind reemplaza la fuente: su `riivolution/RetroRewind6.xml` dice `disc="/Scene/UI/Font.szs"` →
  `external="/RetroRewind6/UI/Font.szs"`, y su versión es distinta (hojas de 512×512 en vez de 1024×1024, otros
  anchos). La página lee primero la de RR (la que el juego usa) y, si no está, la del disco.

**Los colores** (del material `text_01` y de la caja de texto de `go.brlyt`; ver el glosario):

| Qué | Material | × degradado (arriba / abajo) | Resultado |
|---|---|---|---|
| Relleno | «blanco» (255,137,137) | #F2FF00 / #FFE100 | naranja #F28900 → #FF7900 |
| Borde | «negro» (70,70,70) | #F2FF00 / #FFE100 | oliva #424600 |

En la foto del juego se midió relleno ≈ #F08000–#F09000 y borde ≈ #404000–#505000: coincide.

**La entrada** (`go_fade_in.brlan`, 70 cuadros a 60 por segundo):

| Cuadros | Qué pasa en el juego | Qué hace el contador |
|---|---|---|
| 0 → 9 (150 ms) | el número (dos capas) pasa de escala 90 a 2: entra desde gigante; la capa `text_00` es una silueta blanca-amarilla que aparece (opacidad 0 → 1) | la silueta pasa de 2,6× (del 3 al 1) o 2× (del 10 al 4) a su tamaño en 150 ms: 90× taparía toda la pista |
| 9 | aparece la capa naranja (`text_01`) y un destello blanco (`text_light`) que se apaga en 8 cuadros | aparece la cara naranja y la silueta se apaga en 130 ms |
| 9 → 69 | crece despacio de 2 a 2,2 (10 %); la capa naranja se desvanece desde el cuadro 25 | crece 10 % hasta el próximo número, **sin desvanecerse** (un contador tiene que leerse todo el segundo) |

Del 30 al 11 no entra en cada segundo (sería mucho movimiento durante 20 s): solo un golpecito (1,12 → 1) y un
destello tenue. La primera vez que aparece, sí entra completo.

**Cómo llega la fuente a la página sin subir nada.** El juego ya bajó `UI/Font.szs` para usarlo; la página lo lee de
la misma caché de bloques del disco (`disco.leer`, sin pedirlo de nuevo a la red), lo descomprime (Yaz0), lo abre (U8),
lee las dos fuentes (BRFNT) y pinta los glifos que necesita en un `<canvas>` chico, píxel por píxel, como la GPU de la
Wii: color = mezcla(borde, relleno, intensidad) × degradado; opacidad = la del glifo. Abrir el archivo tarda ~5–9 ms,
una vez; pintar un número, menos de 1 ms. El navegador agranda ese canvas con escalado bilineal, igual que el juego.
`web/navegador/fuente-wii.mjs` es nuestro (Yaz0 y U8 son los de `herramientas/szs.mjs`, que es para Node). **Nada del
juego entra a git ni se sube aparte**: la página lo lee en el momento del archivo que el amigo ya tiene.

### 4. El crítico (tres rondas)

- **Ronda 1** (antes del pedido 4): el diseño viejo era una «píldora» de página web (caja oscura, borde amarillo,
  barra). El crítico pidió sin caja ni barra, números grandes con relleno degradado, borde y sombra, anclados a la
  imagen del juego, y rojo con latido en lo urgente.
- **Ronda 2** (ya con las letras del juego): pasan «sin caja», «colores y letras de la cuenta» y «la entrada». **No
  pasan**: (a) arriba, sobre el cartel «MARIO KART» de la meta de esta pista, el naranja se camuflaba; (b) el lugar:
  justo ese cartel en los últimos segundos; (c) en el teléfono el letrero quedaba enorme y tapaba LAP y el mapa.
  Arreglos: bajar el número al **20 % del alto** (debajo del HUD de arriba, sobre el horizonte), un **halo** oscuro
  (`drop-shadow`) en vez de la sombra suave, y mínimos para el teléfono (número 30 px, letrero 12 px). Lo del teléfono
  era un error del CSS: la regla del canvas («alto 100 %») le ganaba a la del letrero por **especificidad**.
- **Ronda 3**: todo pasa (el «1» se lee sobre la reja naranja; en el teléfono, 27 px el número y 10 px el letrero).
- No se usó rojo en lo urgente (lo pedía la ronda 1): el dueño pidió los números de la cuenta, que son naranjas; la
  presión la dan la entrada en cada segundo y los pitidos.

### 5. La prueba sin el juego: una fuente de mentira (banco `cuenta-dnf`)

El banco no puede usar nada del juego, así que la página de prueba **fabrica** un `Font.szs` con la misma forma:

1. Dibuja letras del navegador (relleno blanco, borde negro) en celdas.
2. Las guarda en IA4, en baldosas de 8×4.
3. Arma dos BRFNT:
   - `kart_kanji_font`, con todo: los dígitos por tramo y el resto por pares;
   - `tt_kart_font_rodan_ntlg_pro_b`, solo con `!123GO`.
4. Los empaqueta en un U8 y lo comprime con Yaz0 (con copias de la letra repetida).

Con eso prueba el decodificador de punta a punta y el contador, en 25 puntos:

- La fuente:
  - lee primero la de RR y, si no está, la del disco;
  - sin ninguna, usa la letra de reserva.
- Cuándo se muestra:
  - nada antes de que llegue el primero;
  - 30 cuando llega una CPU;
  - se va al vencer.
- Cómo se ve:
  - los colores naranja y oliva en los píxeles;
  - el letrero cambia a los 2 s;
  - la entrada en los últimos 10;
  - el 3-2-1 con la fuente de la cuenta.
- El tiempo y el sonido:
  - 18 a los 12,5 s;
  - los pitidos de los últimos 5.
- Quien ya llegó: «ESPERANDO A LOS DEMÁS», sin pitidos.
- El tamaño y el lugar:
  - el tamaño de la cuenta de salida (11 % del alto), al 20 % de la imagen;
  - el teléfono;
  - el canvas de otra forma de §79.

### Trampas

- **Las celdas de la hoja van con 1 píxel de separación** y un glifo puede empezar a la izquierda de su lugar (espacio
  a la izquierda negativo, p. ej. −2 en el «0»): sin ese margen, el borde del primer número sale cortado.
- **En IA4 la opacidad va en los 4 bits de arriba** y la intensidad en los de abajo (al revés, el relleno sale
  transparente).
- **La fuente de RR no es la del disco** (otro tamaño de hoja y otros anchos): hay que leer la que el juego carga.
- **`cqh` solo vale dentro de una caja con `container-type: size`**: los tamaños van en un elemento de adentro.
- **Medir con una animación a medio camino da tamaños falsos** (la escala cuenta en `getBoundingClientRect`): la prueba
  termina las animaciones antes de medir.
- Las fotos con la fuente real (para el crítico) se hicieron fuera del proyecto y no se guardan.

### Pruebas

- Banco `cuenta-dnf` **25/25** (con la fuente de mentira).
- Con la fuente real de RR, en esta PC: abrir `Font.szs` 9 ms; «30» 4,6 ms la primera vez (decodifica las celdas) y
  0,1–1,6 ms después. Las fotos sobre una imagen del juego (escritorio, teléfono, ancha) pasaron las 3 rondas del
  crítico.
- `prueba-sala` **26/26** (un punto nuevo): en la carrera 2, apenas llega A, **B ve «29 ¡LLEGÓ EL 1.º!» con la
  fuente del juego** (leída de `UI/Font.szs` por la caché del disco) y **A ve «30 ESPERANDO A LOS DEMÁS»**; 29,8 s
  después (A se mira cada 0,5 s) el juego le termina la carrera a B, igual en las dos, y la tabla suma 146.

```bash
node banco/correr.mjs cuenta-dnf
python herramientas/compilar-web.py --modo navegador
node web/navegador/prueba-sala.mjs
```

## 2026-10-19 · §79 La cortina de Lakitu que no tapaba todo el alto: la imagen ahora es siempre 16:9

**Qué vio el dueño** (una foto en el sitio, con el marco del juego casi cuadrado): «nota ese bug visual cuando
sale del mapa, no se aplica el efecto para todo el stretch vertical». Al caerse en la Senda Arcoíris, la **cortina de
rayas** del rescate de Lakitu (§68) cubría solo la franja del medio de la imagen; arriba (~300 px) y abajo (~300 px)
seguía viéndose la pista. En la foto también se ve que el reloj y las vueltas no estaban arriba, sino a un quinto
de la altura: el HUD también quedaba en la franja del medio.

### 1. La causa: SDL3 agranda el canvas y el juego se estira

1. El canvas nace con **854×480** píxeles por dentro (16:9) y la página lo muestra sin deformarlo
   (`object-fit: contain`). Eso es lo que medí en §68, y por eso dije que «en nuestra página eso no pasa».
2. Pero **SDL3**, la capa de ventana de aurora, escucha el aviso `resize` del navegador: con **cada cambio de tamaño**
   de la ventana, o del marco del sitio, le pone al canvas por dentro **el tamaño de su recuadro**. Por ejemplo,
   854×480 → 1786×1575. La prueba de §68 abría la ventana ya con su tamaño y nunca la cambiaba, así que eso no pasaba.
   En el sitio, el marco de Juegos cambia de tamaño después de cargar (al acomodarse la página, al agrandar la ventana
   o en pantalla completa), y desde ahí el juego "ve" una ventana casi cuadrada.
3. Con una ventana que no es 16:9, el **aspecto dinámico** de WiiCompiled (`dynamic_aspect.cpp`, política
   `AURORA_VIEWPORT_STRETCH`) estira la **escena 3D** para llenarla. Con una ventana alta usa la "expansión vertical":
   la cámara ve más arriba y más abajo. Pero la **capa 2D** del juego (la cortina, el reloj, las vueltas, el mapa) se
   dibuja sobre su hoja fija de 16:9, que queda en el medio. Es como agrandar la imagen de un proyector con una
   transparencia encima: la transparencia no crece. Por eso la cortina tapa solo la franja 16:9 del medio. Con una
   ventana muy ancha pasa lo mismo a los lados, que era lo primero que el dueño había contado en §68.

### 2. El arreglo: `force_16_9` en el Config.toml de la página

La página arma el `Config.toml` del juego cada vez (`mkw.mjs`). Ahora lleva:

```toml
[video]
widescreen = true
force_16_9 = true
```

Con esto WiiCompiled usa la política `AURORA_VIEWPORT_16_9`. El juego dibuja **siempre 16:9**, y lo que sobra del
canvas lo pinta aurora de negro (las **barras**). Ya no importa la forma del canvas: la escena, el HUD y la cortina están
en la misma imagen 16:9, como en la consola. `?aspecto=libre` vuelve al estirado de antes, para comparar.

**Decisión** (tomada sola, como pidió el dueño): 16:9 siempre, en vez de arreglar el estirado. Las razones:
- **Es la imagen del juego.** Mario Kart Wii se hizo para 16:9. Con el estirado se veía más cielo y más pista, pero el
  HUD flotaba en el medio y cualquier efecto 2D de pantalla completa quedaba corto. La cortina era solo el que se notaba.
  Arreglar eso habría sido corregir efecto por efecto dentro del juego.
- **No cuesta nada.** aurora dibuja la escena a la resolución interna del juego, no a la del canvas. El cambio no suma
  trabajo a la GPU: `prueba-navegador` da lo mismo de siempre (60,0 fps, máximo 5,2 ms por cuadro).
- **Quita una diferencia entre consolas.** Con el estirado, en la sala, cada consola tenía la cámara con la forma de su
  propia ventana. Ahora todas tienen la misma (16:9), y la carrera sincronizada no depende del tamaño de la ventana de
  nadie.
- **Lo que se pierde:** en un marco alto o muy ancho quedan barras negras dentro del canvas, en vez de una escena que lo
  llena. En el celular acostado (más ancho que 16:9) quedan franjas finas a los lados.

### 3. La prueba: `prueba-caida.mjs` ahora cambia el tamaño en plena carrera (7 puntos)

La prueba abre la ventana en 960×540 (16:9) y, ya en carrera, la cambia a `--ancho × --alto`, igual que el marco del
sitio. Así reproduce el caso del dueño. Cambios:
- La cortina se mide en los **4 bordes** del canvas (antes solo izquierda y derecha), en el corazón del negro.
- El brillo que decide "está oscuro" se mide en el centro de la **imagen 16:9** y ya no en toda la foto. Antes, en una
  ventana alta, las barras negras oscurecían el promedio y los tramos oscuros salían largos y disparejos (3165, 2333 y
  3384 ms; el 4.º punto fallaba por eso, no por el juego).
- **6.º punto:** el canvas siguió a su recuadro al cambiar la ventana. Asegura que la prueba de verdad reproduce el caso.
- **7.º punto:** fuera del negro, lo que sobra del canvas fuera de la imagen 16:9 es negro. La imagen no está estirada.
- `--sin-cambiar` abre ya con el tamaño final, como antes.

| Ventana (en carrera) | Imagen | Bordes en el negro | Lo que sobra, fuera del negro | Resultado |
|---|---|---|---|---|
| 900×1100, **`?aspecto=libre`** (lo de antes) | estirada a 900×1100 | **107, 114, 75** | **86,7** (se ve la pista) | 5 bien, **2 mal** (el bug) |
| 900×1100 (alta, como la foto) | 900×506 + barras | 0,0, 0,2, 0,7 | 0,0 | **7 bien, 0 mal** |
| 1800×760 (muy ancha) | 1351×760 + barras | 0,0, 3,2, 0,0 | 0,0 | **7 bien, 0 mal** |

Los tres rescates duran 1944, 1905 y 1917 ms (igual que en §68), con el juego a 60 cuadros/s todo el rato. En las
fotos (`build/web/datos/caida/`) las rayas cruzan toda la imagen 16:9 y las barras de arriba y abajo quedan negras.

También: `prueba-tactil` **16/16** (el celular parado y acostado: el recuadro del juego ocupa justo la pantalla y el
mando táctil no cambia) y `prueba-navegador 900` **21/21**.

**Trampa para la próxima:** una prueba de imagen que nunca cambia el tamaño de la ventana no ve lo que pasa en el
sitio. SDL3 solo agranda el canvas con un `resize`. Por eso la prueba ahora cambia el tamaño en carrera.

```bash
node web/navegador/prueba-caida.mjs --ancho 900 --alto 1100                     # alta, como la foto del dueño: 7/7
node web/navegador/prueba-caida.mjs --ancho 1800 --alto 760                     # muy ancha: 7/7
node web/navegador/prueba-caida.mjs --ancho 900 --alto 1100 --extra "&aspecto=libre"   # lo de antes: los bordes se ven (2 mal)
```

### 4. De paso: «Jugar la Copa» quedaba fuera de la vista en el sitio

Al pasar el kit al sitio (`subir-kit.sh`) corrí `prueba-experiencia` (la sala con dos cuentas en la página de Juegos,
ventana 1280×800). Se cortó en el punto 13: el botón **«Jugar la Copa N ▸»** del selector nuevo de §74 estaba «fuera de
la vista» y no se podía apretar. La causa:
- En el sitio, el marco del juego mide `100vh − 120 px` (680 px en esa ventana) y aparece **debajo** del vestíbulo:
  empieza a 615 px del borde de arriba, así que casi todo el marco queda más abajo del borde de la ventana.
- El panel de la copa va **pegado abajo del marco** (`position: fixed` dentro del marco). Una persona veía el título
  «Elige la copa de la sala» y las primeras tarjetas, pero no el panel ni el botón, salvo que bajara la página. Playwright
  no puede desplazarse hasta un elemento fijo, por eso la prueba lo destapó.

Arreglo, en dos lados:
- **El sitio** (`colabtex/src/juegos/mkw.js`, `verMarco()`): al aparecer el marco, `frame.scrollIntoView({ block:
  "nearest" })` desplaza la página lo justo para verlo entero.
- **El juego** (`mkw.mjs`, `mirame()`): al abrir un selector de la sala (la copa, la playlist, sugerir, «Lo que viene»,
  «+ Agregar pistas»), le manda al sitio `{tipo:'mirame'}` y el sitio hace lo mismo. Sirve por si el jugador había subido
  a leer el chat. Si el marco ya se ve entero, no se mueve nada.

Resultado: `prueba-experiencia` **17/17**, con la carrera de los dos en el sitio. Las pruebas del sitio
(`colabtex/tests/mkw.test.cjs`) dan 16/16 y el bundle `juegos-app.js` se rearmó con esbuild.

```bash
node herramientas/prueba-experiencia.mjs          # ~8 min: la sala de dos cuentas en el sitio, copa y carrera (17)
```

### 5. La foto que parecía partida: la raya de la largada con el kart quieto

Con el kit de §78, `prueba-experiencia` dio **16/17**. Falló el último punto, «se ve UNA vista, no la pantalla
partida»: en la ventana de Piloto Dos, el detector (`foto-pantalla.mjs`) encontró una «costura» en el medio de la
imagen (salto 37,9, cuando lo típico era 3,4). La foto mostraba una sola vista. El kart de B estaba quieto en la
largada, y el borde entre la madera y la franja a cuadros de la meta caía **justo a media altura** y cruzaba la imagen
entera. En una sola foto, eso se ve igual que la costura entre dos vistas: un escalón de punta a punta.

Dos cambios, uno por cada causa:
- **Recortar las barras.** Desde §79 el canvas puede traer barras negras arriba y abajo. El detector ahora las recorta
  antes de medir: busca dónde empiezan 4 filas con luz seguidas, para saltarse el borde de 1 px del marco. El «medio» es
  el de la imagen del juego y el salto típico sale de filas de imagen. Sin el recorte, con barras, el medio podía caer
  en cualquier lado.
- **Dos fotos con el kart andando** (`dosFotosPartidas`, 1,5 s entre una y otra, acelerando). Una costura de verdad no
  se mueve: está en la misma fila en las dos. Un borde de la pista baja por la imagen cuando el kart avanza. Cuenta como
  partida solo si **las dos** fotos la muestran. Como distinguir un ruido fijo de la red (siempre en la misma frecuencia)
  de una señal que barre: se mira dos veces.

Comprobado con fotos de verdad y con 4 partidas armadas (dos vistas de verdad, una arriba y otra abajo, con y sin
barras): las partidas dan salto 38 a 57 con típico 6,4 (partida ✓). Las de una vista dan 1,4 a 4,6, salvo la de la
largada con el kart quieto (37,9). En la prueba nueva: A **55,2 → 18,3**, B **30,3 → 8,5**. Las primeras fotos tenían
la raya de la largada en el medio y las segundas ya no: **17/17**.

## 2026-10-19 · §80 Que un jugador lento no frene a los demás: el retraso de cada uno, el relevo y el corte en dos fases

### Qué pidió el dueño

Por la sesión del selector, el dueño pidió (2026-10-19): «también piensa con un crítico externo cómo hacer handle de
los errores de conexión; al ser un juego con un máximo de 12 jugadores, que cada uno retrase y laguee al resto es
imposible de jugar».

### El problema: en el lockstep el más lento marca el ritmo

La carrera de la sala es un **lockstep** (§61, ver el glosario): ninguna consola corre un cuadro sin tener los botones
de todos para ese cuadro. Hasta §79 eso tenía cuatro consecuencias:

- **Un retraso igual para todos.** Lo anunciaba el «decisor» al empezar cada carrera, según la peor ida medida con
  los pings (§70). Si UNO tenía 80 ms de ida, todos jugaban con el kart respondiendo 6 cuadros tarde.
- **Una PC lenta frenaba a todos.** Si una PC hacía 30 cuadros por segundo, las demás la esperaban en cada cuadro y
  toda la sala iba a 30. En el banco nuevo: **50 % del ritmo** para todos.
- **Un tirón de la red de uno, una pausa para todos**, cada vez.
- **Un corte de golpe: 30 s de pausa** para todos (el margen de la sala, §73) antes de seguir sin él.

Con 4 jugadores ya molesta; con 12, alguno siempre tiene un mal momento y la carrera no avanza.

### El crítico (otro Claude, con la propuesta por escrito)

La primera propuesta tenía: retraso de cada uno, un corte «temporal» de quien hiciera esperar más de 300 ms, y volver a
la misma carrera con una barrera. El crítico encontró **tres errores graves** (los tres podían separar las copias de
la carrera, que es lo peor que puede pasar):

1. **Botones que llegan tarde y se cuelan después del corte.** Una consola podía recibir un botón viejo del cortado
   *después* de haber corrido ese cuadro como «sin nadie», o al revés. Arreglo: al contestar la pregunta del corte,
   cada consola **se queda quieta** en el cuadro que dijo, hasta saber la decisión, y el corte va *después* del máximo.
2. **La pregunta dejaba afuera al que se corta** (y a los que no contestaban a tiempo). Arreglo: se pregunta a
   **todos**; y si una consola ya corrió más allá del corte (no contestó a tiempo), se da cuenta sola: su copia ya no
   es la de los demás, **se sale de esa carrera** y vuelve en la siguiente.
3. **Dos decisores a la vez podían fijar dos cortes distintos.** Arreglo: el decisor de cada corte es uno solo (el
   primero que sigue en el orden de la sala, que no sea el cortado), y **un corte fijado no cambia nunca**.

Y varios importantes: la barrera para volver en la misma carrera sobraba (complicada y frágil; quien se corta vuelve en
la siguiente, como al recargar, §75); 300 ms cortaría a medio mundo en un tirón; el retraso de cada uno necesitaba
reglas claras para subir y bajar; el kart del que no responde no debe estrellarse (mantener acelerar y soltar el
volante de a poco); 12 jugadores no caben en 4 puertos de mando; y faltaba comparar también **los botones** usados en
cada cuadro, no solo el avance de los karts. Su recomendación central fue el **relevo**: que la autoridad lleve, en sus
propios paquetes, los botones de quien se atrasa.

### Lo que quedó (`web/navegador/lockstep.mjs`)

**A. El retraso de cada uno.** Los botones de cada jugador los escribe solo él, y cada paquete dice de qué cuadro es
cada botón. Por eso cada uno puede elegir su retraso sin ponerse de acuerdo con nadie. Al empezar la carrera escribe
«neutro» en los primeros cuadros (hasta su retraso) y desde ahí lo de verdad. Si sube el retraso, rellena los cuadros
del medio con lo que está tocando; si baja, no escribe nada hasta alcanzar lo ya escrito (lo mandado no se toca). El
de partida sale de los pings (§70), pero mirando a la **mitad que mejor llega**, no al peor: si a uno solo le llega
tarde lo de todos, la conexión lenta es la de él. Se elimina el anuncio global (el mensaje 9).

**B. Los informes de medio segundo y quién tiene la culpa.** Cada consola mide, para cada jugador, la **holgura** con
que le llegan sus botones (cuántos cuadros antes de necesitarlos), cuánto lo esperó, y cuántos **ratos** (de medio
segundo) seguidos le fue mal. Un rato es «malo» si lo esperó medio cuadro o más, o si sus botones llegaron tarde o no
llegaron. Si llegaron justos (holgura 0), no es malo: solo le pide a él que suba uno. Cada uno lo cuenta a todos
(mensaje 10). Con eso:
- **El problema es de m** solo si lo ve **más de la mitad** de los que informan de él. Si a uno solo le llega todo
  tarde, el problema es la conexión de ese uno.
- **No cuenta el voto** de un jugador al que la mayoría ve mal, o justo, o que va relevado, ni el de uno que ve mal a
  TODOS los demás (dos o más; «pasa hambre»): si su conexión es la mala, ve mal a todos.
- **Lo heredado no cuenta.** Si m se atrasó porque esperaba a otro que la mayoría ve mal, la culpa no es de m. Cuando
  toda la sala espera a Dani, los que reciben el paquete de Dani unos milisegundos antes alcanzan a esperar a los que
  lo reciben después; parece que se atrasaron, pero fue Dani.
- **Mi retraso** sube 1 si la mayoría me ve mal o justo un rato. Si son dos ratos seguidos, sube lo que falte (hasta
  4). Baja de a 1 si la mayoría tiene 3 cuadros de holgura durante 4 ratos (2 s). Va de 2 a 12 cuadros (200 ms).

Como un lazo de control con realimentación: cada uno ajusta SU retraso con lo que miden los demás, sin un controlador
central.

**C. El relevo.** Un jugador es la **autoridad**: el primero de la sala que sigue en la carrera. Si la mayoría ve mal
a alguien dos ratos seguidos (y no es heredado), la autoridad lo **releva**. En SU propio paquete de cada cuadro
agrega a quién releva y el botón de cada relevado:
- el de verdad, si ya le llegó;
- si no, uno **inventado**: el último que tuvo de él, si no tiene más de 6 cuadros;
- si es más viejo: solo acelerar (si lo tenía apretado), sin botones nuevos, y el volante soltándose en 30 cuadros.

Todas las consolas, el relevado incluido, usan para él lo que dice la autoridad. Como todas necesitan igual el paquete
de la autoridad (es un jugador más), el relevo **no agrega viajes ni esperas**, y nadie espera al relevado. Lo deja de
relevar cuando pasan 3 s relevado y 3 s sin que la mayoría lo vea mal. Mientras está relevado no baja su retraso, y
si la autoridad tuvo que inventar sus botones, sube 2: así sus botones de verdad alcanzan a entrar en el paquete.

**Si la autoridad es la lenta** (todos esperan su paquete): si la mayoría la ve mal 4 ratos seguidos (2 s), y no es
heredado, le **pasa el papel** al que mejor llega. Lo escribe en su paquete («desde el cuadro siguiente, la autoridad
es Beto»), así todas las consolas cambian en el mismo cuadro. La nueva autoridad sigue relevando a los mismos y,
además, a la vieja.

**D. El corte en dos fases**, solo para lo que el relevo no puede tapar: un silencio **de golpe**. Los cuadros que ya
contaban con los botones de verdad del que se calló no los tiene nadie. Ahí se espera el **margen**: en la sala
**2 s** (antes 30). Si no aparece, su decisor lo corta, con los tres arreglos del crítico:
- pregunta a todos (mensaje 5);
- cada uno contesta hasta dónde llega (mensaje 6): lo que tiene de él, lo que ya corrió y, si va relevado, hasta donde
  la autoridad ya escribió su relevo. Al contestar, reparte lo que tiene de él y se queda quieto ahí;
- corta en el máximo + 1;
- al que se calló no se lo espera si no se lo oye hace medio margen.

Quien recargó avisa que se salta la carrera (§75) y se corta ya. Un relevado que se calla del todo se corta igual
(nadie lo espera, pero el juego sí, en la meta).

**E. Una huella de los botones.** La huella de cada 120 cuadros (mensaje 4) lleva, además del avance de los 12 karts,
una mezcla de **todos los botones usados en cada cuadro**. Si dos consolas usaron botones distintos, se ve al toque,
aunque los karts todavía no se hayan separado.

**Lo que ve cada uno** (`mkw.mjs`, cada medio segundo):
- el relevado: «📶 Tu conexión o tu PC van lentas: tu kart responde con retraso (la carrera no te espera)»;
- los demás: «📶 jugador 3 va lento (conexión o PC): su kart responde tarde; la carrera no lo espera».
  Estos dos se muestran 6 s, una vez cada vez que cambia quién va relevado: no tapan la carrera.
- quien se salió de la carrera: «📶 Te desconectaste de esta carrera: tu kart sigue sin ti y vuelves en la
  siguiente…»; quien fue cortado: «📶 Se cortó tu conexión: tu kart sigue sin ti y vuelves en la siguiente carrera…».
  Estos quedan en pantalla mientras dure: esa carrera ya no es suya y tiene que saber por qué (lo pidió la sesión
  del selector: nada de una carrera quieta sin explicación).

Quien se salió **no avisa** «terminé» a la sala, porque sus puntos salen de una carrera que ya no es la de los demás
(en el bloque de la sala; ver «Coordinación»). En la carrera siguiente toma la tabla de la sala, como quien recargó.

`?relevo=0` = sin relevo, para comparar; `?retraso=fijo` = 3 para todos y sin ajustar (como antes de §70).
`?redMala=70,10,5,ida` (`malla.mjs`, solo pruebas) = la red mala de mentira también en lo que **sale** de la página:
la conexión mala es la de ese jugador, en los dos sentidos.

### Las pruebas

**Banco `relevo` (nuevo, sin el juego).** Igual que el banco `lockstep`, pero cada consola corre **a su ritmo, como el
juego**: un cuadro por tic de 10 ms (el juego: 16,7). Si esperó, el cuadro siguiente va en el próximo tic, sin ponerse
al día (Mario Kart Wii no se pone al día: si un cuadro tarda, el juego va más lento). Se mide el **ritmo** de las
consolas buenas: los cuadros que corrieron ÷ los que debían correr en ese tiempo.

| Prueba | Resultado |
|---|---|
| Dani con 30-50 ms de ida (en cuadros de 10 ms: 3-5 cuadros, como 50-80 ms reales) y 10 % perdido, 4 jugadores | Ana, Beto, Carla al **100 %**; retraso de Dani 12, de los demás 2-5; mismos botones en todos los cuadros; lo inventado para Dani, siempre sus propios botones de ≤ 6 cuadros |
| Dani con 20-30 ms y 5 % | los demás al 100 %, Dani con 6-7 y al final **sin relevo** |
| Carla con la PC a la mitad | Ana y Beto al **100 %** (Carla relevada); **sin relevo, 50 %** los dos |
| Apagón de Dani de 0,6 s | una espera de ~0,6 s, sin cortes, y después 100 % |
| Beto se va de golpe (margen 1 s) | una sola espera de ~1,02 s y el corte en el mismo cuadro en las dos |
| La autoridad con la PC a la mitad | pasa el papel a Beto (una vez); Beto y Carla al 100 % |
| El corte que llega tarde a Carla, que ya había corrido más allá | Carla se sale de la carrera sola; Ana la corta y sigue; hasta el corte, las dos corrieron lo mismo |

**Con el juego (`web/navegador/prueba-relevo.mjs`, nuevo).** Tres pestañas, tres «computadores» de la misma sala,
corren UNA carrera directa (3 humanos + 9 CPU). La pestaña C tiene la red mala de mentira en los dos sentidos
(`?redMala=70,10,5,ida`: 70 ± 10 ms de ida y 5 % perdido, o sea ~140 ms de ida y vuelta). Los tres aceleran (B dobla
un rato) y se miden 25 s de carrera. Después, B se «traba» dos veces (un bucle le toma el hilo, como un tirón de la PC
o una pestaña que el navegador congela un rato): 1,5 s (menos que el margen) y 3 s (más).

| Prueba | Resultado |
|---|---|
| `node banco/correr.mjs relevo` | **21/21** (cada parte se repitió 3 a 6 veces mientras se afinaba; las dos de Dani, 6 veces seguidas sin falla) |
| `node banco/correr.mjs lockstep` (el de siempre, con las pruebas del retraso global cambiadas) | **42/42** (3 seguidas) |
| `node banco/correr.mjs red` (+ `?redMala=…,ida`) | **26/26** |
| `node web/navegador/prueba-relevo.mjs` | **10/10**: A **59,6** y B **59,5** cuadros/s, **0,00 ms** de espera por cuadro; C con retraso 8; huellas iguales en las tres (36 cada una, karts y botones), sin cortes; traba de 1,5 s: nadie se corta (A y C la esperaron una vez, 1,36 y 1,42 s); traba de 3 s: A y C cortan a B en el **mismo cuadro (2563)** y siguen, y B ve «📶 Se cortó tu conexión: tu kart sigue sin ti y vuelves en la siguiente carrera…» |
| `prueba-relevo --red=0` (el control: nadie con red mala) | A 59,8, B 59,6, C 59,8 cuadros/s; retrasos A 3, **B 10**, C 2 |
| `prueba-relevo --sin-relevo` (como antes de §80 en el relevo) | A 59,9, B 59,9, C 60,0 cuadros/s; retrasos A 9, B 2, C 12 |
| `node web/navegador/prueba-sincro.mjs --directa` (dos pestañas) | **13/13**: huellas 18 iguales, espera 0,00 y 0,23 ms por cuadro; cada una con su retraso (A 12, B 2: ver Trampas) |
| `node web/navegador/prueba-sala.mjs` | **25/26**: la carrera 2 termina por DNF a los 29,9 s, en el mismo cuadro en las dos y con la misma tabla de 146; falló solo «los relojes del fin a menos de 0,5 s» (651 ms; ver Trampas) |
| `prueba-sala --recarga` | 1.ª vez **27/28**: el aviso del relevo quedaba encima de la carrera (arreglado: 6 s). 2.ª vez, «ningún aviso tapa la carrera» ✓, pero fallaron 3 puntos de la elección de personaje de A (antes de la carrera, sin lockstep; en la 1.ª pasaron): avisado a la sesión del selector |

**Qué dicen los números.**
- Con la conexión de C mala, **A y B no la sienten**: siguen a 60 y no esperan.
- **C paga su conexión**: 8 cuadros de retraso, contra 3 o 4 que tendría con una red buena.
- **El control explica por qué B también subió.** Sin nadie con red mala, B igual llegó a 10. Con tres juegos en la
  misma PC, cada cuadro lleva 12 a 14 ms de trabajo, de los 16,7 que hay. Cada pestaña tiene tirones de verdad. B es
  la única que dobla: al doblar ve partes nuevas de la pista y compila gráficos (en el medidor, un segundo a 29
  cuadros/s). El programa hace lo correcto: el que se traba paga su propio retraso, no los demás. Con cada jugador en
  su PC eso no pasa. Por eso la prueba exige que el retraso de C cubra su conexión (≥ 8) y no sea menor que el de A
  (que va derecho), no que sea el más grande de los tres.
- **Sin relevo**, con esta red, el retraso de cada uno ya alcanza para que A y B no esperen. Donde el relevo hace la
  diferencia es la **PC lenta**: en el banco, 100 % con relevo contra 50 % sin él.

### Trampas

- **El banco viejo corre las consolas tan rápido como llegan los botones**, sin el reloj del juego. Ahí la holgura
  siempre es 0 y el ajuste del retraso subía a todos hasta 12 y relevaba a todos. Por eso el banco `lockstep` corre
  con los informes apagados (`informeCada: 0`) y lo de §80 se prueba en `relevo`, con consolas a ritmo.
- **Dos cuadros en un tic.** El primer arnés a ritmo daba 111 %: el temporizador a veces despertaba un poco antes del
  tic y se colaba otro cuadro. Ahora cada cuadro va en un tic posterior al anterior, nunca en el mismo.
- **Una prueba que se trababa sola**: para que a Ana no le llegaran los últimos botones de Beto, se bloqueaba todo
  paquete con ellos, también el reparto del corte. Ana esperaba para siempre botones que el corte necesitaba. Era la
  prueba, no el programa: ahora Beto se va justo después de lo que Ana tiene.
- **Esperas de 4 ms contaban como «malas»** y relevaban a Dani sin motivo. Menos de medio cuadro no le hace perder el
  cuadro al juego.
- **La cascada**: con Dani relevado y llegando justo, su voto volvía a contar. Como su conexión es la mala, ve tarde a
  todos; con una queja más, Beto o Carla quedaban «culpables» y subían a 9. Arreglo: no cuenta el voto del que va
  relevado ni del que llega justo, y lo heredado no es culpa.
- **Con una red muy mala (10 % perdido) el relevado ya no vuelve.** Sin ponerse al día, cada racha de pérdidas lo
  deja un poco más atrás, y el retraso máximo (12) ya no alcanza. Sigue manejando con sus propios botones (los de hace
  ≤ 6 cuadros), con más retraso; los demás, al 100 %.
- **La llegada parecía culpa.** En la primera prueba con el juego, A y B subieron a 12 y C (el de la red mala) se
  quedó en 2. Al empezar, A y B esperaban a que C terminara de cargar la pista, y en esos ratos no llegaba nada nuevo
  de nadie. Yo contaba «no llegó nada» como «llegó tarde». A incluso relevó a B desde el cuadro 5. Arreglos: la espera
  de la llegada vuelve dudoso el rato; que no llegue nada sin que yo lo haya esperado no prueba nada (quizá él
  esperaba a otro); y para volver a lo directo hacen falta datos de que llega con holgura, no basta con que nadie se
  queje.
- **El que recibe tarde de todos se queja de todos.** Con tres jugadores, cada uno tiene solo dos que informan de él.
  Si uno de esos es C, que se queja siempre, una sola queja más ya es mayoría. Arreglo: no cuenta el voto del que ve
  mal a todos los demás (dos o más): ese «pasa hambre».
- **Una prueba con tres juegos en la misma PC mide también los tirones de la PC.** Ver el control (`--red=0`).
- **El aviso del relevo tapaba la carrera.** En `prueba-sala --recarga` las fotos de la prueba congelaron a A varias
  veces seguidas. A le pasó la autoridad a B y B lo relevó: eso está bien. Pero el aviso «Tu conexión va lenta…»
  quedaba fijo todo lo que durara el relevo, y la prueba exige que ningún aviso tape la carrera. Ahora el relevo se
  avisa 6 s. Y dice «conexión o PC»: un tirón puede ser de cualquiera de las dos.
- **Con el retraso de cada uno, las consolas ya no van exactamente juntas en tiempo real.** Una puede ir adelantada
  hasta el retraso de la otra (≤ 12 cuadros, 200 ms): la carrera es la misma, solo que cada una la corre un poco
  antes o después. Después del fin el reloj de la carrera sigue corriendo y cada pestaña se lee en su momento. En
  `prueba-sala` los relojes del fin, leídos uno tras otro, diferían en 651 ms (la prueba pedía menos de 500), con la
  misma tabla de 146 puntos en las dos.
- **El que se traba queda atrás, y su retraso sube.** El juego no se pone al día. Cada tirón de una PC la deja un
  poco atrás de las demás por el resto de la carrera, y su retraso sube para cubrirlo. En `prueba-sincro --directa`,
  con dos pestañas en la misma PC y la red de la casa, A terminó en 12 y B en 2. Lo paga solo el que se trabó, como
  pidió el dueño. Pero en una carrera larga con tirones, su kart puede quedar con 200 ms de retraso. Se reinicia en
  cada carrera, porque todos largan juntos. La otra opción es la de GGPO (la biblioteca de red de los juegos de pelea):
  que el que va adelantado se frene un poco (un cuadro cada tanto) para esperar al de atrás. Así el retraso no sube,
  pero el tirón de uno se reparte como tironcitos en los demás. Queda para que el dueño elija.
- **Lo que no resuelve §80**: 12 jugadores. Hoy la sala es de hasta 4 humanos (4 puertos de mando de la Wii; §73). El
  paquete ya trae «a quién releva» como un byte con un bit por mando (alcanza para 8); para 12 hay que ampliar eso y
  los puertos del juego.

### Coordinación

La línea de «no avisar terminé si me salí» va en la vigía del fin de la sala (`mkw.mjs`); la sesión del selector, que
lleva ese bloque, dijo que la pusiera yo. Le pidió dos cosas a §80, las dos probadas con el juego: que quien queda
fuera vea un aviso claro (no una carrera quieta) y que un tirón de 1-2 s no saque a nadie con el margen de 2 s.

```bash
node banco/correr.mjs lockstep relevo red
node banco/correr.mjs "relevo?solo=1"          # una sola parte (para depurar)
node web/navegador/prueba-relevo.mjs           # con el juego: 3 pestañas, C con la red mala
node web/navegador/prueba-relevo.mjs --sin-relevo
```

## 2026-10-20 · §80b La sincronía de tiempo: que los tirones de uno no se le sumen en el retraso (prueba, `?sincroTiempo=1`)

### Qué pidió el dueño

Hacer aquí la tarea que propuse al final de §80: probar la otra manera de tratar los tirones, detrás de una bandera
(`?sincroTiempo=1`), y medirla contra lo de §80, para que él elija.

> **Después lo eligió:** la sincronía quedó **prendida por omisión** (`?sincroTiempo=0` = sin ella, como en §80). Ver
> «La decisión del dueño», al final de esta sección.

### El problema que quedó de §80

Mario Kart Wii **no se pone al día**: si un cuadro tarda (un tirón de la PC: limpiar memoria, compilar gráficos),
el juego no corre los siguientes más rápido para recuperar; simplemente queda más atrás. En la sala, la consola que
se trabó queda atrás de las demás para el resto de la carrera, y sus botones les llegan más justos. El lazo del
retraso (§80) lo cubre subiéndole el retraso a ella. Con el próximo tirón, queda más atrás y sube otra vez: **se va
sumando**. En el banco, Carla con un tirón de 40 ms cada 1,5 s termina en el máximo, 12 cuadros (200 ms), con un
promedio de ~10 en la carrera. Lo paga solo ella, como pidió el dueño, pero su kart se vuelve lento de responder.

### La idea (la de GGPO) y la trampa del lockstep

GGPO (la biblioteca de red de los juegos de pelea) lo resuelve con la **sincronía de tiempo**: el que va adelantado
se frena un poco para esperar al de atrás. Copiarla tal cual en el lockstep sale mal, porque aquí hay **dos maneras
de ir atrás**:

1. **Por un tirón propio.** Después del tirón corre normal, solo que atrás: va **suelto**. Frenarse sirve: él no
   puede ponerse al día, pero los demás sí pueden esperarlo.
2. **Porque espera lo de los demás.** Es Dani, de §80: su conexión trae tarde lo de todos y él corre cada cuadro recién
   cuando le llega. Frenarse **no** sirve. Si yo me freno, mis botones le llegan más tarde y él se atrasa conmigo: la
   sala iría más lenta para siempre, persiguiendo un desfase que nunca se cierra. Como frenar el auto de adelante
   cuando el de atrás va remolcado: el remolque frena igual.

Por eso **solo me freno por uno que va suelto**: uno que en su último rato (medio segundo) no esperó a nadie ni se
estaba poniendo al día. Tampoco por uno relevado, cortado, o más de 20 cuadros atrás: eso es del relevo.

### Cómo sé cuánto voy adelante

- Cada paquete de botones lleva **un byte nuevo**, el *adelanto*: cuántos cuadros por delante del cuadro que está
  corriendo quien lo manda está el último botón del paquete. El que lo recibe resta y sabe **en qué cuadro iba el otro
  al mandarlo** (`último − adelanto`). Si el paquete lo reenvía otro, va 0xFF: no se usa.
- Mi medida de él: **mi cuadro ahora − el suyo al mandar** = lo que voy adelante + lo que tardó en llegar. Me quedo
  con la más chica del rato (la del paquete que llegó más rápido).
- Él mide lo mismo de mí, y me lo cuenta en el informe de medio segundo (un byte más por jugador).
- **La mitad de la diferencia de las dos medidas es cuánto voy adelante:** lo que tarda la red se cancela, si tarda lo
  mismo de ida que de vuelta. No hace falta saber cuánto tarda la red. Es como miden la hora los relojes por internet
  (NTP): un pulso de ida y otro de vuelta, y el desfase es la mitad de la diferencia.

### El freno

- Si voy **más de 1 cuadro adelante** de alguien suelto, me freno: en `pad`, antes de tomar el cuadro siguiente,
  espero un cuadro sin hacer nada.
- A lo más 4 por rato y uno cada 8 cuadros: como mucho un 12 % más lento, un momento. Como el juego no se pone al
  día, ese cuadro de espera me deja un cuadro más atrás, que es justo lo que quiero.
- En pantalla es un cuadro repetido de vez en cuando.
- El freno va antes de tomar el cuadro: para los demás sigo en el anterior, el que ya corrí, y el corte en dos fases
  (§80) no se confunde.
- **El retraso baja más rápido.** Con la sincronía, si a todos les sobran 6 cuadros o más durante 2 ratos, baja de
  una vez lo que sobra (deja 3 de holgura). El desfase que lo hizo subir ya se corrigió frenando.

### Las pruebas

**Banco `relevo`, parte 9 (nueva).** Carla con un tirón de 40 ms (4 cuadros de 10 ms) cada 1,5 s; dos vueltas de
1500 cuadros, sin y con la sincronía.

| | Retraso de Carla al final | En promedio | Ritmo de Ana y Beto | Frenos de Ana / Beto |
|---|---|---|---|---|
| Sin sincronía (lo de §80) | **12** (el máximo) | **9,8 a 10,4** | 100 % | 0 |
| Con `?sincroTiempo=1` | 5 a 7 | **5,7 a 7,0** | **97 %** | ~40-49 |

Un tirón de 4 cuadros pide un retraso de ~5-6 para que nadie lo espere: eso queda. Lo que ya no pasa es que se
sume tirón tras tirón. En las dos vueltas, las tres consolas reciben los mismos botones en cada cuadro.

**Toda la página `relevo` con la bandera prendida** (`node banco/correr.mjs "relevo?sincroTiempo=1"`): pasa todo lo
de §80 también. Se destaca **Dani con la red mala**: los demás siguen al 100 %, porque no se frenan para siempre por
él (va remolcado, no suelto). Además, la PC lenta (relevada: no se la espera), el apagón y la autoridad lenta.
El banco `lockstep` (consolas sin el reloj del juego, sin informes) da 42/42 con y sin la bandera.

**Con el juego.** Son las mismas pruebas de §80, con `--extra=&sincroTiempo=1`.

| Prueba | Sin sincronía | Con `?sincroTiempo=1` |
|---|---|---|
| `prueba-sincro --directa` (2 pestañas en la misma PC, red de la casa) | **13/13**; el retraso de A termina en **12**, promedio **11,8**; B 2 | **13/13**; A termina en **3**, promedio **5,6**; B 2,1 con 48 frenos; espera 0,13 ms por cuadro |
| `prueba-relevo` (C con ~140 ms de ida y vuelta y 5 % perdido) | (§80) retrasos al final: A 6, B **11**, C 8 | **10/10**; A **57,6** y B **57,7** cuadros/s; espera 0,06 y 0,03 ms por cuadro; promedios A **4,0**, B **4,6**, C 9,3 (paga su conexión); nadie relevado; tirones de 1,5 s y 3 s como en §80 |
| `prueba-relevo --red=0` (el control, sin red mala) | (§80) A 3, **B 10**, C 2 | A 5, B 4, C 2 (promedios 5,0 / 4,2 / 2,2) |

Con la sincronía, a nadie se le acumula el retraso por sus tirones; el que tiene la red mala sigue pagando lo suyo.

Unas corridas coincidieron con pruebas de la otra sesión (dos juegos más en la misma PC). En esas, las pestañas iban a 45-49 cuadros/s, con «Tu PC no alcanza 60», y esperas de menos de 0,3 ms por cuadro. No cuentan: se repitieron con la PC tranquila. La fila del control es de esas corridas, así que sus cuadros por segundo no valen, solo los retrasos.

### Lo que cuesta cada una (para que el dueño elija)

| | Sin sincronía (§80, por omisión) | Con `?sincroTiempo=1` |
|---|---|---|
| Al que se traba | Paga todo, en su retraso, que se va sumando en la carrera (hasta 12 cuadros = 200 ms); se reinicia en cada carrera | Paga solo lo de un tirón (~5-6 cuadros si sus tirones son de 4) |
| A los demás | Nada | Después de cada tirón de otro, se frenan un poco hasta alcanzarlo (un cuadro cada 8; ~3 % en el banco): un cuadro repetido de vez en cuando |
| Con uno de red mala (que espera a todos) | Nada | Nada (no se lo persigue) |

**Mi recomendación:** prenderla, después de probarla en dos PC de verdad. Un 3 % de frenadas suaves cada tanto se
nota mucho menos que un kart que responde 200 ms tarde. Pero el dueño pidió que nadie atrase a los demás: por eso
queda apagada hasta que él diga.

### Cómo lo hace Mario Kart 8 Deluxe (y el Mario Kart Wii original)

El dueño pidió mirar Mario Kart 8 Deluxe como referencia. Nintendo no publicó cómo funciona su red. Lo que sigue sale
de la documentación de la comunidad (mkwiiki, ingeniería inversa de Pia, la biblioteca de red de Nintendo) y de lo que
cuentan los jugadores.

**La diferencia de fondo: no es un lockstep.** En Mario Kart 8 Deluxe, y en el modo en línea original de Mario Kart
Wii, cada consola **maneja su propio kart** y les manda a las demás dónde está y qué está tocando. Los karts de los
demás se **adivinan**: si los datos llegan tarde, se supone que siguen derecho y se los corrige cuando llegan. Por eso
**un jugador lento nunca congela a los demás**. Lo que se ve, en cambio:
- karts que saltan de un lugar a otro (se corrige la adivinanza);
- ítems que te pegan sin haberlos visto venir, o que les pegan a dos a la vez;
- la ruleta de ítems trabada hasta que cae en uno por defecto (Nintendo arregló en la versión 3.0.1 los «ítems que no
  se entregan bien cuando la comunicación es inestable»).

Es otro precio: en vez de esperas, carreras que no son exactamente iguales en cada pantalla. Nuestro lockstep da
siempre la misma carrera en todas, y por eso tiene que manejar las esperas (§80).

**El Mario Kart Wii original** (mkwiiki, «Network Protocol»):
- Cada consola manda un paquete RACE con un registro RACEDATA de 0x40 bytes por jugador: posición, botones y otros
  datos.
- Le manda a **una consola distinta cada dos cuadros**, por turno. Con 12 jugadores, cada uno recibe noticias de cada
  otro solo cada ~1/3 s. mkwiiki dice que esa es la causa principal del lag en salas grandes.
- Tiene un registro **SLOT**: una consola con problemas de ancho de banda **manda su tráfico a través de otra**, como
  intermediaria. Es la misma idea que nuestro **relevo**.
- Al terminar, el tiempo del primero se manda a todos y los demás tienen un **tiempo limitado** para llegar. Es nuestro
  DNF (§77).

**Pia (Mario Kart 8 Deluxe, Splatoon 2):**
- Cada sala tiene un **anfitrión** y, si se va, otro toma su lugar (*host migration*), con prioridad para el de mejor
  conexión. Es nuestro **traspaso de la autoridad**.
- En Splatoon 2, del mismo tiempo y la misma biblioteca, cada consola lleva un **reloj común**. Si los relojes se
  separan, por ejemplo **después de un pico de CPU**, se vuelven a sincronizar. Es justo lo que hace la sincronía de
  tiempo de §80b.
- Si de un jugador no llega nada por ~5 s: «error de comunicación». A una consola que se vuelve un **cuello de
  botella** se la puede echar para que la sesión siga fluida. Es nuestro corte y el «fuera».

**Lo que se toma de referencia:**
- **La sincronía de tiempo está en la línea de Nintendo**: resincronizar el reloj después de un tirón. Es un argumento
  más para prenderla.
- **El relevo (SLOT), el traspaso (*host migration*) y el plazo del final (DNF)** ya existen en nuestro diseño, con la
  misma idea.
- **El margen.** Nintendo espera ~5 s antes de dar a uno por perdido, pero sin congelar a nadie: los demás siguen con su
  kart adivinado. Nosotros no podemos seguir sin sus botones, así que conviene un margen corto (los 2 s de §80).
- **La otra arquitectura (para el dueño):** el juego ya trae adentro su modo en línea, el de RACEDATA. Si en vez del
  lockstep se usara ese modo sobre nuestra malla WebRTC (sin los servidores del Wi-Fi), la sala se comportaría como Mario
  Kart Wii en línea: nadie espera a nadie, con los saltos y los ítems raros de siempre. Es un trabajo grande y cambia lo
  decidido en §73 (la sala sin Retro WFC). Queda anotado como opción, no se hace ahora.

Fuentes:
- [mkwiiki: Network Protocol](https://mkwiiki.org/wiki/Network_Protocol)
- [OatmealDome: Splatoon 2's Netcode and Matchmaking](https://oatmealdome.me/blog/splatoon-2s-netcode-an-in-depth-look/)
- [Pretendo: PIA](https://nintendo-wiki.pretendo.network/docs/pia/)
- [ResetEra: Why is Mario Kart relatively stable while Smash Online isn't?](https://www.resetera.com/threads/why-is-mario-kart-relatively-stable-while-smash-online-isn%E2%80%99t.355120/)
- [GameSpot: parche 3.0.1 de Mario Kart 8 Deluxe](https://gamespot.com/articles/new-mario-kart-8-deluxe-patch-out-now-fixes-one-th/1100-6452425/)
- [Reglas MSEL de Mario Kart 8 Deluxe](https://help.generationesports.com/hc/en-us/articles/360053404431-MSEL-Mario-Kart-8-Deluxe-Rules)

### Un hueco de §80 que encontró la otra sesión: el corte que no llega

En una copa de prueba de la sesión del selector (`prueba-sincro --copa`, dos pestañas), a A se le cayó la conexión con
B. B esperó el margen y cortó a A en el cuadro 902. Pero el aviso del corte va **una sola vez** por el canal confiable
(«tcp»), y ese canal estaba caído: el aviso se perdió. A volvió, nunca supo que la habían cortado y siguió corriendo
su kart con sus botones, donde B ponía «sin nadie». Las copias se separaron, y B marcó «¡DESINCRONIZADO… botones!».
Es el caso típico: un corte casi siempre viene de una conexión que se cayó, y justo ahí se pierde su aviso.

Tres arreglos (`lockstep.mjs`):
1. **Los cortes se repiten.** Cada medio segundo, cada consola les repite a todos los cortes de esta carrera (10 bytes
   cada uno). Al que vuelve le llega el suyo. Si ya corrió más allá, se sale de la carrera; si no, sigue sin su kart.
2. **La huella no se compara con un cortado.** Si el que manda la huella está cortado desde ese cuadro o antes, su
   copia se separó a propósito y se va a salir: no es un «desincronizado».
3. **Las islas.** Si la conexión se parte en dos, cada lado corta al otro. Con los cortes repetidos, los dos se
   enterarían de su corte y los dos se saldrían. Por eso el aviso de un corte lleva cuántos siguen según el que corta y
   el mando más bajo de ellos. Sigue el lado con más jugadores; si empatan, el que tiene el mando más bajo (el de la
   autoridad). Del lado que pierde no vale ningún corte, ni el de mí ni el de los míos. Los dos lados hacen la misma
   cuenta.

**Banco `relevo`, parte 10:** a Ana se le cae la conexión 3 s (lo del «tcp» se pierde). Beto y Carla la cortan en el
mismo cuadro, terminan sin «desincronizado» y sin cortarse entre ellos. Ana, sola, los había cortado a los dos, pero
eso no vale. Al volver, Ana se entera de su corte y se sale de la carrera. **3 de 3.**

### La decisión del dueño (2026-10-20 00:15)

Con los números de arriba, el dueño eligió: «Sí, prende la sincronía de tiempo por omisión (`?sincroTiempo=0` para
apagarla)». En `lockstep.mjs` la bandera se dio vuelta: ahora se prende sola y se apaga con `?sincroTiempo=0`. El
banco `relevo` corre por omisión con la sincronía y también sin ella (`"relevo?sincroTiempo=0"`): **27/27 en las
dos**. En la parte 9 el promedio del retraso de Carla es 6,3 y 5,9 con la sincronía, contra 10,0 y 10,4 sin ella. Las
pruebas con el juego ya se habían corrido con la sincronía prendida (arriba). La parte 9 compara el **promedio** y ya
no pide además un valor del final: el final es una foto, y una vez cayó justo después de un tirón (9 con un promedio
de 5,7).

### Trampas

- **La sincronía «de libro» perseguía a Dani.** La regla de «solo por uno suelto» salió de pensar el caso de Dani
  antes de escribirla; con la página entera prendida, el caso de Dani lo confirma (100 % de ritmo).
- **La primera versión todavía subía hasta 11.** Frenaba bien, pero el retraso, después de subir por cada tirón,
  bajaba de a 1 cada 2 s. Con mucha holgura ahora baja de una vez lo que sobra.
- **El promedio dice más que el final.** El retraso al final depende de si el último tirón fue justo antes de medir:
  la prueba compara el promedio de la carrera (`estado().retrasoMedio`).
- **No correr dos juegos a la vez.** Las pruebas con el juego de §80b las paré cuando la otra sesión avisó que corría
  la suya. Al limpiar maté por error una prueba de ella (`prueba-sincro --copa`), porque busqué los procesos por el
  nombre del archivo. Se lo avisé. Ahora se mata solo lo que uno arrancó.

```bash
node banco/correr.mjs "relevo?solo=9"              # los tirones, sin y con la sincronía
node banco/correr.mjs "relevo?solo=10"             # el corte que no llega (y las islas)
node banco/correr.mjs relevo "relevo?sincroTiempo=0" lockstep     # con la sincronía (por omisión) y sin ella
node web/navegador/prueba-sincro.mjs --directa [--extra=&sincroTiempo=0]
node web/navegador/prueba-relevo.mjs [--extra=&sincroTiempo=0] [--red=0]
```

## 2026-10-19 · §81 La ayuda de la tarjeta de video aparece cuando hace falta (D4)

**Por qué.** El plan tenía pendiente la D4: «la ayuda de *tarjeta de video equivocada* en la página del sitio». En
Windows, la tarjeta de video que usa el navegador la decide **Windows**, no la página. En un PC con dos tarjetas (la
integrada del procesador y una dedicada), Windows puede darle la integrada al navegador y el juego va lento (§54). La
página pide «alto rendimiento», pero el navegador puede ignorar el pedido. La página ya mostraba qué tarjeta usa y,
plegada, cómo cambiarla (cajón → Avanzado → Video). Desde §69 la página del sitio es la misma, así que también estaba
ahí. Lo que faltaba es que alguien la **viera**: nadie abre «Avanzado» porque el juego va lento.

**Qué hace ahora** (`web/navegador/aviso-gpu.mjs`). Cada segundo mira lo que la página ya mide (cuadros por segundo,
trabajo por cuadro, espera del disco) y, si el juego va lento **un buen rato por trabajo de esta PC**, muestra abajo a la
izquierda: «🐢 El juego va lento en esta PC. Si tienes una tarjeta de video dedicada, Windows puede estar dándole al
navegador la integrada.» con dos botones:
- **«Ver cómo»** abre el cajón en Avanzado, despliega la ayuda (Configuración → Sistema → Pantalla → Gráficos → el
  navegador → *Alto rendimiento*) y la trae a la vista;
- **«✕»** lo calla por 7 días (guarda la hora en `mkw.avisoGpu`).

**La regla, para que no moleste por nada:**
- Un segundo es «lento» si da **menos de 54 cuadros** y el **trabajo pasa de 12 ms** por cuadro. Si el trabajo es poco,
  el juego estaba esperando algo y no es la tarjeta.
- Solo cuentan los **segundos de juego**: pasado el arranque (cuadro 600), pestaña a la vista, sin esperar el disco
  más de 200 ms, y **fuera de la sala**. En la sala la lentitud puede venir de otro jugador, y la sala tiene su propio
  aviso (§70.7).
- Se enciende con **8 segundos lentos entre los últimos 12**, y **una vez por visita**.
- **Solo si cambiar la tarjeta puede ayudar.** Eso es cuando el navegador da la misma tarjeta pidiendo «alto
  rendimiento» o «bajo consumo»: Windows elige, y solo en Windows. Si el navegador hace caso al pedido, la página ya
  tiene la mejor tarjeta y el aviso no sale. Tampoco sale si la que dio es una **NVIDIA** (siempre dedicada): es lo
  que pasa en esta PC (el navegador ignora el pedido, pero da la RTX), y ahí el aviso habría dicho algo falso.
- La tarjeta **«por software»** (sin tarjeta de video) da su propio texto, en cualquier sistema.
- Las pruebas automáticas no lo ven (`navigator.webdriver`), salvo `?avisoGpu=1`; `?avisoGpu=0` lo apaga.

**Prueba en el banco** (`banco/pruebas/aviso-gpu`, sin el juego): segundos inventados con la forma de lo que mide la
página y una revisión de tarjeta inventada. **18/18**:
- no sale a 60 cuadros/s, ni por un tirón de 5 s;
- sale con 8 s lentos seguidos y también con lentitud a ratos (8 de 12);
- no sale con poco trabajo, ni en el arranque, con el disco, con la pestaña escondida o en la sala;
- no sale si el navegador ya da la mejor tarjeta o una NVIDIA, ni fuera de Windows (salvo «por software»);
- «Ver cómo» abre la ayuda;
- «✕» lo calla 7 días y después vuelve;
- sale una sola vez por visita, y espera a saber qué tarjeta hay.

**En la página de verdad** (una pestaña, con 8 segundos lentos dados a mano): el aviso sale abajo a la izquierda sin
tapar nada importante, y «Ver cómo» abre el cajón en Avanzado con la ayuda desplegada (`cajon`, `avanzado` y `ayuda` en
true; el aviso se esconde).

```bash
node banco/correr.mjs aviso-gpu
```

## 2026-10-19 · §82 El VR se mueve con las carreras de la sala y queda en Firebase

**Por qué.** El dueño: «que el VR (y BR) se mueva con las carreras de la sala y quede guardado en Firebase». En la sala
(§73) el juego no calcula el VR: para él son carreras sin conexión. Su función de puntos (`UpdatePoints`, 0x8052E950)
solo mueve el VR en los modos en línea (escenario +0xB50 entre 7 y 10). Hasta ahora el VR solo cambiaba en Retro WFC
(§59), que la sala ya no usa.

**Decisiones** (comunicadas al dueño):
- **La regla original de Mario Kart Wii**, no la de Retro Rewind en línea. La de RR depende de datos de la sala en
  línea (multiplicadores por evento, topes por rango) y copiarla sería transcribir el código de Pulsar (GPL). La
  original está en el juego mismo y mkwiiki la describe.
- **Solo los humanos.** Las CPU no tienen VR; en línea no hay CPU.
- **BR no se mueve:** es el puntaje de las batallas, y la sala no tiene batallas.
- **Quien se corta pierde contra todos, y nadie gana por él.** Lo primero es la regla del juego (desconectarse = último).
  Lo segundo es la de Retro Rewind (mkwiiki: «si un rival se desconecta y ganas por eso, no ganas VR»): así nadie junta
  VR con un amigo que se va a propósito.

### 82.1 La regla, sacada del juego

Leída en el C++ traducido (regla «decompilar uno mismo»): 0x8052D118 (lo que gana el que llegó antes), 0x8052D1C0 (lo
que pierde el que llegó después) y 0x8052CEF8 (la curva).
1. Cada **par** de humanos de la carrera: el que llegó antes gana el par.
2. Diferencia = VR del perdedor − VR del ganador, recortada a ±9998.
3. t = (diferencia + 9998) × 1/4999: un número de 0 a 4.
4. Los puntos salen de una **curva por puntos** (B-spline cúbica) con los valores **0, 1, 8, 50, 125** (la tabla de
   0x8088FF60), en precisión simple (32 bits), y se truncan.
5. El ganador suma esos puntos y el perdedor resta los mismos.

Algunos valores:

| Le ganaste a alguien con… | Puntos |
|---|---|
| 9998 VR menos | 0 |
| 5000 menos | 1 |
| 2000 menos | 6 |
| el mismo VR | **13** |
| 2000 más | 26 |
| 5000 más | 55 |
| 9998 más (o más) | 112 |

Con 4 humanos de igual VR: el 1.º +39, el 2.º +13, el 3.º −13 y el 4.º −39.

**La trampa del 1/5000.** En la lectura del código el paso parecía «÷ 5000», y así lo escribí primero. La comparación
contra el juego (82.4) dio 325 diferencias distintas de 19 997. El número de 0x8088FF90 es **1/4999** (0,00020004).
Con él, ±9998 cae justo en las puntas de la curva (0 y 4). Con 1/5000 los bordes truncaban un punto distinto.

### 82.2 En la sala (`web/navegador/vr-sala.mjs`, `sala-carrera.mjs`, `mkw.mjs`)

- **La foto de los VR.** Cada página le dice a la anfitriona su VR (`{t:'vr'}`, cada segundo mientras ella no lo
  tenga). Ella los lleva en el estado (`vrs`) y al empezar cada carrera los **congela** (`vrCarrera: {n, vrs}`). Todas
  las consolas calculan esa carrera con los mismos números: lo que A le gana a B es justo lo que B le pierde a A.
- **El peor caso, al abrir la carrera.** Cada página guarda como su VR el de perder contra todos los que corren (con dos
  de 5000: 4987). Si cierra o recarga a mitad de carrera, ese queda, que es lo mismo que ven los demás (se cortó).
- **Al terminar** (la misma vigía que avisa «terminé», §75): los puestos salen del juego (Raceinfo, cada jugador +0x20,
  lo mismo que lee `UpdatePoints`). Se saca quién quedó fuera desde el principio (la sala, o cortados en el cuadro 0) y
  quién se cortó a mitad (la carrera sincronizada; yo, si me salí, §80). Con eso se calcula el cambio y la página
  **guarda solo el suyo** (`vr.informar`: aquí y en Firebase, `mkw/vr/<uid>`, §59). Muestra «🏁 VR 5000 → 5013 (+13)» y
  le avisa al sitio (`{tipo:'vr'}`). `?vr=0` = el VR no se mueve en la sala.
- **La copia local, por cuenta.** `vr.mjs` guardaba la copia del navegador en `mkw.vr`, una para todo el navegador:
  dos cuentas en el mismo navegador (o las dos pestañas de una prueba) se pisaban el VR. Ahora va en `mkw.vr.<uid>`. La
  cuenta que todavía no tiene la suya parte de `mkw.vr` (jugó sin sesión y después entró, como antes).
- **El sitio** (`colabtex/src/juegos/mkw.js`): con `{tipo:'vr'}` el vestíbulo muestra el VR nuevo de quien juega. Al
  terminar la copa (`fin`) vuelve a leer el de los demás.

### 82.3 El banco (`banco/pruebas/vr-sala`, 27 puntos, sin el juego)

Comprueba:
- **La curva:** 13 contra uno igual; de 0 a 112; nunca baja al crecer la diferencia (las 19 997); los nudos y sus bordes.
- **Las carreras:** en 300 salas al azar sin cortes, la suma da 0, el 1.º nunca pierde y el último nunca gana; también
  los empates.
- **Los cortes:** los cortados, y que en 300 salas al azar con cortes nadie termina peor que su peor caso.
- **Los topes:** de 1 a 1 000 000; un VR desconocido vale 5000.
- **La lectura de una memoria de Wii inventada.**
- **El árbitro con tres consolas:** la foto de cada carrera, un VR nuevo a mitad de carrera que queda para la siguiente,
  y los mismos cambios en las tres.
- **La copia local por cuenta.**

### 82.4 Contra el juego mismo (`web/navegador/prueba-vr.mjs`, 7 puntos)

Un **gancho de prueba** en `web/juego/directo_nativo.cpp` (`Module._mkw_vr_prueba(desde, cuántas)`):
- En el siguiente SectionMgr::Update arma dos «puntajes» en la pila del juego (muy por debajo de la que usa; el VR en
  +4, dos bytes) y llama a las dos funciones del juego para cada diferencia.
- La prueba abre una carrera directo, pide las 19 997 y compara una por una con `vr-sala.mjs`.
- También lee la tabla y los números de la cuenta en la memoria, y que el byte +0x20 de cada jugador es su puesto.

Resultado: **7/7**. Las 19 997 diferencias dan igual que el juego, tanto lo que se gana como lo que se pierde. La tabla
es 0, 1, 8, 50, 125, el paso es 1/4999, y los puestos van del 1 al 12 sin repetir.

### 82.5 Con el juego, dos pestañas (`prueba-sala.mjs`, 4 puntos nuevos)

| Momento | Lo que pasó |
|---|---|
| Al abrir la carrera 1 | Las dos guardaron 4987 (el peor caso) |
| Al terminar la 1 | El humano que llegó antes **+13** y el otro **−13**: lo mismo en las dos, guardado |
| Al abrir la 2 | La foto de la anfitriona es la de después de la 1 (4987 y 5013) |
| Al terminar la 2 | De nuevo lo que gana uno lo pierde el otro (los dos volvieron a 5000) |

Resultado: **29/30.** El ✗ no era del VR. Ese punto comparaba los relojes de carrera leídos en cada pestaña al terminar,
pero el reloj sigue corriendo después del fin y cada pestaña se lee en su momento. Con dos juegos a la vez en la PC (la
otra sesión corría `--recarga`) llegó a 2,3 s. La comparación medía cuándo se leyó cada una, no el juego. Ahora pide
que en las dos el juego le haya dado la llegada a B. Que la carrera es la misma ya lo dice la tabla, idéntica en las
dos. Con `--recarga` hay un punto más: B se fue a mitad de la 1, se queda con 4987 y A no gana nada (5000).

```bash
node banco/correr.mjs vr-sala
node web/navegador/prueba-vr.mjs
node web/navegador/prueba-sala.mjs
node web/navegador/prueba-sala.mjs --recarga
```

### 82.6 Todo al sitio: el VR, el relevo, la sincronía de tiempo y las copas al azar (2026-10-20 01:40)

**Qué y por qué.** El sitio (`terceros/Paginita-Pro`, el repo de la página) guarda su propia copia de nuestra página del
juego en `juegos/mkw/`: el **kit** (ver Glosario). La página de Juegos abre esa copia en el marco. Si no se actualiza,
los jugadores siguen con la página vieja aunque aquí ya esté arreglado. Desde el último envío (commit `27b8e92` del
sitio, §78 y §79.5) faltaban:
- **§80 y §80b**: un lento no frena a los demás (relevo, corte en dos fases) y la sincronía de tiempo prendida
  (`lockstep.mjs`, `malla.mjs`, `banco/pruebas/relevo`, `prueba-relevo.mjs`);
- **§81**: la ayuda de la tarjeta de video (`aviso-gpu.mjs`, `banco/pruebas/aviso-gpu`);
- **§82**: el VR de la sala (`vr-sala.mjs` nuevo, `sala-carrera.mjs`, `mkw.mjs`, `vr.mjs`, `banco/pruebas/vr-sala`,
  `prueba-vr.mjs`);
- **§83**: las copas al azar que se separaban (`lockstep_nativo.cpp`, `semillas_nativo.cpp`, `depurar_reloj.cpp`,
  `compilar-web.py`).

Además, en el sitio mismo estaban sin commit desde §82:
- `colabtex/src/juegos/mkw.js`: el marco avisa `{tipo:'vr'}` y el vestíbulo muestra el VR nuevo de quien juega; al
  terminar la copa (`fin`) vuelve a leer el de los demás (`pideVrs`);
- `colabtex/src/juegos/reglas.js`: la explicación «Tu VR» (antes decía que la sala no lo movía; ahora, que cada carrera
  lo mueve con la regla de Mario Kart Wii);
- el bundle `juegos-app.js`.

**Cómo.**
```bash
bash herramientas/subir-kit.sh     # 217 archivos a terceros/Paginita-Pro/juegos/mkw (frena si ve algo del juego)
cd terceros/Paginita-Pro/colabtex
npx esbuild src/juegos-main.js --bundle --minify --format=iife --target=es2020 --outfile=<carpeta aparte>/juegos-app.js
cmp <carpeta aparte>/juegos-app.js ../juegos-app.js     # sin salida = iguales
```
Para saber si el bundle estaba al día no lo rearmé encima del del sitio. Lo armé en una carpeta aparte y lo comparé
byte a byte con `cmp`: salieron idénticos (2.602.768 bytes). El `juegos-app.js` del sitio ya tenía los cambios de
`mkw.js` y `reglas.js`.

**Pruebas.**

| Prueba | Resultado |
|---|---|
| `node --test tests/mkw.test.cjs tests/mkw-worker.test.cjs` (en `colabtex/`) | 22/22 |
| `npm run test:juegos` (todas las del sitio) | 977/978: la que falla no es de Mario Kart (abajo) |
| `node herramientas/prueba-experiencia.mjs` | **17/17** (la sala con dos cuentas, la copa, elegir en el juego y la carrera sincronizada) |

- La que falla es `controles.test.cjs` («cada entrada del salón tiene código que leer»). Espera la dirección del código
  de Worms como `colabtex/src/juegos/worms.js`, y en Windows le llega `colabtex\src\juegos\worms.js` (ver **Separador de
  ruta** en el Glosario). Es la herramienta que detecta los controles de cada juego: no toca Mario Kart, y ninguno de
  nuestros archivos la cambia. No la arreglé porque es de otro juego del sitio; queda anotada para el dueño.
- `prueba-experiencia` tardó ~2 min y no ~8: los emuladores y las cachés de pipelines y de bloques ya estaban calientes,
  y la carrera se mira solo hasta que 5 huellas seguidas coinciden.
- Otra sesión estaba midiendo el aviso de PC lenta (`prueba-sincro` en el puerto 8190). Esperé a que no quedara ningún
  node suyo y le avisé al terminar: dos juegos más en la misma PC le habrían cambiado las medidas.

**El commit del sitio** (`9a8bb31`, local, sin push) lleva solo `colabtex/src/juegos/mkw.js`, `colabtex/src/juegos/reglas.js`,
`juegos-app.js` y `juegos/mkw/` (menos `juegos/mkw/AGENTS.md`), con rutas explícitas. No toca los cambios del sitio que
no son nuestros: `index.html`, los `*.dc.html`, los `index.html` sellados de otros juegos y `AGENTS.md`.

**Lo que el sitio NO lleva: el programa.** §83 cambió el C++ del juego, o sea el `.wasm`. Ese va a R2 y lo sube el
dueño (`docs/publicar.md`: `compilar-web.py --modo navegador --final` y `subir-r2.mjs --subir`). Hasta entonces el
arreglo de las copas al azar no llega a los jugadores, aunque el sitio ya tenga la página nueva. La página nueva no le
pide al programa nada que el viejo no tenga: las dos funciones nuevas del programa (`mkw_vr_prueba`,
`mkw_vr_prueba_lista`) solo las usa `prueba-vr.mjs`. Así que no se rompe si el sitio sale antes que el programa.

**Trampas.**
- `subir-kit.sh` copia también lo que no está en git **ni** en `.gitignore`: el `AGENTS.md` suelto del proyecto llegó a
  `juegos/mkw/AGENTS.md`. Por eso el commit va con rutas y nunca con `git add -A`.
- La bitácora y el PLAN viajan en el kit tal como están al copiarlo. Si se escriben después, hay que pasarlos al kit
  antes del commit del sitio. Aquí los copié a mano, solo esos dos: mientras tanto otra sesión había empezado a cambiar
  `web/navegador/mkw.mjs` y `prueba-inicio.mjs` sin commit. Un `subir-kit.sh` nuevo se habría llevado al sitio su
  trabajo a medio hacer (el kit copia la carpeta tal como está, no lo del último commit).
- `sitio-local.mjs` (y por eso `prueba-experiencia`) sirve la página desde `web/navegador/` de esta carpeta, **no** desde
  la copia del kit. Mi corrida usó el `mkw.mjs` con el cambio de la otra sesión. Ese cambio solo toca «Multiplayer →
  Local» del menú de inicio, que esta prueba no recorre (usa Single Player y Multiplayer → Online), así que el 17/17 vale
  también para lo que quedó en el sitio. Para probar exactamente el kit hay que correrla con la carpeta sin cambios
  ajenos.

## 2026-10-20 · §83 Las copas que se separaban (C2): el sorteo de reserva de los objetos usaba la hora de cada PC

**Resumen.** En la sala todas las consolas corren la misma carrera a la vez, y cada una calcula a los 12 karts. Para
que den lo mismo, todo el azar de la carrera tiene que salir igual en todas. Una copa al azar (pistas 65.0, 75.0, 39.0 y
74.1, semilla 3549642503) se separaba siempre cerca del cuadro 6100 de la carrera 1. La causa: cuando la caja sortea un
objeto que ya no tiene cupo, Retro Rewind sortea otro con un dado propio, y la semilla de ese dado salía de **la hora de
cada PC**. Ahora, durante la carrera sincronizada, esa hora es el reloj de la carrera (igual en todas), y la semilla
vuelve a cero en cada carrera. La copa que fallaba pasa entera con las huellas iguales.

### 83.1 El síntoma

La C2 del plan es correr muchas copas sincronizadas con pistas y semillas al azar (`herramientas/copas-al-azar.mjs`,
§70). Ya en §70 esta copa se separaba en el cuadro ~6046 de la carrera 1. Se fijó el reloj de dos funciones más
(0x80750AAC y 0x807DC048, que arman su propio azar con la hora), pero siguió: 2 de 4 corridas bien. Quedó en pausa
por la etapa M.

Hoy, con `prueba-sincro.mjs --copa` y esa copa, se separó en las tres corridas, siempre en la carrera 1. En dos se
notó en los cuadros 6240 y 6120, y lo separado era «carrera», es decir, la posición de los karts. En la tercera, una
pestaña siguió en la carrera 1 mientras la otra ya había pasado a la 2.

### 83.2 Primero, una falla de la red (no era la C2)

En una de las corridas la separación fue otra: «botones distintos» en el cuadro 960. Era un **corte perdido**. La red
cortó a un jugador (§80) y el aviso del corte no llegó a la otra pestaña, así que cada una usó botones distintos para él.
Se lo pasé a la sesión de la sala, que lo arregló en el commit `a8212f3`: los cortes se repiten cada medio segundo, las
huellas ya no se comparan con quien quedó cortado, y si la red se parte sigue la isla más grande (§80b).

En ese mismo commit va mi cambio a `prueba-sincro.mjs --copa`. Si las huellas no coinciden, la prueba escribe
`DESINCRONIZADO (A/B)` con el cuadro y qué se separó, y guarda el registro de red de cada pestaña en `red-A.txt` y
`red-B.txt`.

Para separar la carrera de la red, las corridas siguientes llevaron `&margen=120&relevo=0`: nadie se corta antes de
120 s y nadie releva a nadie. Igual se separó en el 6240. Entonces era la carrera misma.

### 83.3 Un amperímetro en cada rama: quién lee la hora durante la carrera

Lo que separa dos copias de la misma carrera casi siempre es algo que lee **la hora del procesador** (cada PC tiene la
suya). Desde §61 las funciones que sacan su azar de la hora (la lista `RELOJ_CARRERA` de `compilar-web.py`) leen el
**reloj de la carrera**, que es igual en todas. Faltaba saber si alguna otra la leía.

Para eso se armó un programa de depuración, el **vigía del reloj**:
- Con `MKW_DEPURAR_RELOJ=1`, `compilar-web.py` cambia en **todas** las demás funciones del juego la lectura de la hora
  (`PPC_Mftb`) por `PPC_MftbVigia(función, desde dónde)` (`web/juego/depurar_reloj.cpp`).
- `PPC_MftbVigia` devuelve lo mismo, la hora de verdad, pero con la carrera sincronizada anota en la consola
  `[RELOJ] función lr cuadro vez`.
- Anota las 3 primeras lecturas de cada lugar en cada carrera, y después la 4.ª, 8.ª, 16.ª… Así se ve si un lugar lee
  todo el tiempo sin llenar la consola.

Los nombres salen del **mapa de símbolos** de la comunidad (`terceros/Wiicompiled/projects/mkwii/MAP.txt`). Esto es lo
que leyó la hora durante la carrera:

| Quién (dirección → nombre) | Cuándo | ¿Decide algo de la carrera? |
|---|---|---|
| 0x800A4AF0 `nw4r::snd::SoundThread::FrameProcess` y 0x800895D0 `AxManager::AuxCallbackFunc` | todo el tiempo | no: el sonido |
| 0x80210024 `EGG::AsyncDisplay::postVRetrace` y 0x8021A06C `EGG::Display::calcFrequency` | cada cuadro | no: la pantalla. Lo que sí tocaba la carrera, `beginFrame`, está fijo desde §62 |
| 0x8051DFC0 (de `HomeMenuMgr::Calc`) | cada cuadro | no: el fundido del menú HOME (el brillo, de 0 a 255) |
| 0x8052F924 `RacedataScenario::InitRng` | 1 vez, antes de largar | no: `semillas_nativo.cpp` pisa esas semillas enseguida |
| 0x801AAD74 `OS::GetTick`, llamado desde `MiiHeadsModel::Init` (0x807DC270) | 1 vez, cuadro 0 | no: las caras de los Mii |
| … llamado desde Retro Rewind en 0x81804548 (objetos condicionales) | 1 vez, cuadro 0 | **sí**, en las pistas que los usan |
| … llamado desde Retro Rewind en 0x81836284 (sorteo de reserva de los objetos) | 1 vez, **cuadro 5975**, en las dos pestañas | **sí: era esta** |

La última fila es la clave. Las dos pestañas leyeron la hora en el mismo cuadro, 5975, desde el mismo lugar, y cada una
recibió la de su PC. La separación se notó en la huella siguiente (se compara cada 120 cuadros): 6120 o 6240.

### 83.4 Qué hacía Retro Rewind con la hora

El código traducido se leyó aquí (es de Nintendo y de Retro Rewind: se lee para entender, no se copia). Para saber qué
era cada función se miró también el código de Pulsar, que es público. Pulsar es el motor de Retro Rewind, con licencia
GPL, y solo se lee.

**(a) El sorteo de reserva de los objetos** (`rr_kamek_81836190`, `CustomItems.cpp` en Pulsar):
- Hay un tope de objetos peligrosos a la vez en la pista (caparazones azules, rayos, Bill Bala…).
- Si la caja sortea uno que ya no tiene cupo, Pulsar sortea otro con un **LCG** (un dado de cuenta fija:
  `x ← x · 1103515245 + 12345`).
- Su semilla es una **semilla estática** (vive en 0x818A0C28). Empieza en 0 y, la primera vez que hace falta, se llena
  con `OS::GetTick`, la hora del procesador.
- En esta copa esa primera vez llega en el cuadro 5975, a los ~100 s de largar. Desde ahí la misma caja daba otro objeto
  en cada consola.
- Por eso fallaba siempre en el mismo lugar: es un **disparador determinista**. Con la misma semilla y las mismas
  pistas, el primer objeto sin cupo sale siempre en el mismo cuadro.

**(b) Los objetos condicionales** (`rr_kamek_818044F8`, al empezar cada carrera):
- Un número del 0 al 7 decide cuáles objetos propios de Retro Rewind (números 0x1000 a 0x1FFF) aparecen en la pista.
- En contrarreloj y contra fantasmas vale 0. En línea usa un número que le pasa el juego, no la hora. En VS, que es
  como corre nuestra sala, salía de `OS::GetTick`.
- En esta copa no hizo daño (si no, se habría separado mucho antes), pero en otra pista cada consola podía tener otros
  obstáculos.

### 83.5 Por qué se le escapó a `RELOJ_CARRERA`

`OS::GetTick` es una función de una sola instrucción. El traductor la **copia adentro** de cada función que la usa, y
`RELOJ_CARRERA` cambia esas copias en las funciones de su lista. Pero estas dos partes de Retro Rewind no la copian: la
**llaman**, y la original seguía leyendo la hora de verdad.

En la tabla de 83.3, cada fila con `801aad74` es justamente una llamada a la original. Ninguna función de la lista
podía cubrirla.

### 83.6 El arreglo

**`web/juego/lockstep_nativo.cpp`.** Una envoltura de `OS::GetTick` (0x801AAD74):
- Con el reloj fijo encendido y una carrera en curso (hay Raceinfo), devuelve el reloj de la carrera de ese lugar:
  `PPC_MftbCarreraEn(100, lr)`, el reloj por lugar de §62.
- Ese número sale del cuadro, del lugar y de cuántas veces se leyó. Las consolas lo llaman en el mismo cuadro desde el
  mismo lugar, así que todas reciben el mismo.
- Fuera de la carrera (menús, cargas) sigue la hora real.

**`web/juego/semillas_nativo.cpp`.** Al preparar cada carrera sincronizada, la semilla del sorteo de reserva
(0x818A0C28) vuelve a 0:
- La primera vez que haga falta en **esa** carrera, se siembra con el reloj de la carrera.
- Sin esto, quien recarga a mitad de la copa (§75) volvería con la semilla en 0 mientras las demás siguen su lista de
  números. Se separaría en el primer objeto sin cupo de la carrera siguiente.

**`herramientas/compilar-web.py`.**
- Suma el reemplazo de `func_801AAD74`.
- Agrega una revisión: si `rr_kamek_81836190` ya no lee la semilla en 0x818A0000 + 3112 (por ejemplo, porque se tradujo
  otro Retro Rewind), la compilación se detiene en vez de escribir en cualquier lado.
- El vigía queda como herramienta de depuración: `MKW_DEPURAR_RELOJ=1` con `web/juego/depurar_reloj.cpp`.

### 83.7 Pruebas

| Prueba | Antes | Ahora |
|---|---|---|
| `prueba-sincro.mjs --copa --pistas=65.0,75.0,39.0,74.1 --semilla=3549642503` (con el relevo y el margen de la sala) | se separaba cerca del cuadro 6100 de la carrera 1 (3 de 3 corridas) | **4/4**: las huellas iguales en toda la copa (116 de 116) y las dos pasan solas a la carrera 2 |
| `copas-al-azar.mjs --copas 4 --sala c2-arreglo-20261020` (pistas y semillas nuevas) | — | **16/16, ninguna separada**: 58.1/66.3/30.0/47.3, 54.0/41.3/26.0/20.3, 49.0/72.1/0.1/4.1 y 48.3/44.0/20.2/64.3, cada una con la carrera 1 entera y 900 cuadros de la 2 (6 a 7 min) |

```bash
MKW_DEPURAR_RELOJ=1 MKW_DEPURAR_LS=1 MKW_CFLAGS_EXTRA=-DMKW_VIGIA python herramientas/compilar-web.py --modo navegador --carpeta build/web-vigia
MKW_BUILD=build/web-vigia/navegador node web/navegador/prueba-sincro.mjs --copa --pistas=65.0,75.0,39.0,74.1 --semilla=3549642503 --minutos=4 "--extra=&margen=120&relevo=0"
node web/navegador/prueba-sincro.mjs --copa --pistas=65.0,75.0,39.0,74.1 --semilla=3549642503
node herramientas/copas-al-azar.mjs --copas 4
```

Con el programa normal (`build/web`, recompilado con el arreglo), `prueba-sincro.mjs` sin copa da **10/11**. Las huellas
coinciden; el ✗ es «sin avisos de sala lenta»: la pestaña A va a 48–50 cuadros/s. No viene de §83. La misma
prueba con la envoltura de `GetTick` apagada (un programa aparte, compilado solo para comparar) da lo mismo, y
también sin la sincronía de tiempo (`&sincroTiempo=0`). Esa noche la PC tenía ~24 % de la CPU ocupada por otros
programas sin ninguna prueba corriendo. En §70 este punto pasaba (11/11); queda por ver si es la PC o algo de
§73–§80. **Resuelto en §85:** es la PC. El código de §70, compilado hoy, falla igual, y en §70 la prueba ya iba a
52–55 cuadros/s. El punto ahora pide avisos ciertos, no cero avisos.

Lo que no se probó directo: la vuelta a cero de la semilla para quien **recarga** (§75). Haría falta que, en la
carrera a la que vuelve, salga un objeto sin cupo. Se razonó a partir del código: sin la vuelta a cero, esa consola
sembraría en otro momento que las demás.

Las huellas «iguales A 100 / B 93» no son una falla. Cada pestaña cuenta las que pudo comparar: la suya y la de la
otra para el mismo cuadro. Cuando la prueba termina, a una todavía le faltan las últimas de la otra. Todas las
comparadas fueron iguales.

### 83.8 Trampas

- **`?rastro=1` (§70) no sirvió aquí.** Hace una huella de cada RaceinfoPlayer que incluye punteros. En cada pestaña la
  memoria del juego queda corrida por lo que pasó en los menús: el mismo montón está en 0x80AF8880 en una y en
  0x80AF87E0 en la otra, 0xA0 de diferencia. Así los 12 karts «difieren» desde el primer cuadro. Solo sirve si las dos
  pestañas quedaron con la memoria igual.
- **No correr dos juegos pesados a la vez** si no hace falta. Cada pestaña tiene sus tirones, y con relevo y cortes
  encendidos se mezclan fallas de la red con las de la carrera. Para ver solo la carrera: `&margen=120&relevo=0`.
- **Compilar aparte** (`--carpeta build/web-c2` y servir con `MKW_BUILD=build/web-c2/navegador`) para no pisar el
  programa que otra sesión está probando. La primera vez compila todo, ~5,5 min. Copiar `pipelines.bin` y
  `bloques.json` del build normal para que cargue igual.

## 2026-10-20 · §84 Lo que faltaba para lanzar: Multiplayer local directo (M8) y los 200cc de la sala (D1)

**Qué se pidió:** «continúa hasta que esté listo el juego». Se revisó el PLAN contra la definición de «Terminado»: un
amigo entra al sitio, carga desde R2 y juega a 60 fps; partidas, récords y VR quedan en Firebase; la sala corre sin
separarse. Quedaban cosas chicas del juego y la preparación para publicar (el paso 0 de `docs/publicar.md`). Las
tareas grandes y separables se propusieron como sesiones aparte: los Mii invitados (M10), el sonido con AudioWorklet
(E1), el kit al sitio (§82.6, ya hecho) y el aviso de PC lenta de `prueba-sincro`.

### 84.1 Multiplayer → Local, directo por código (M8)

**Antes:** en el menú de inicio JloKart, Multiplayer → Local usaba el «piloto», que apretaba botones por detrás hasta el
menú principal del juego y dejaba el cursor sobre «2 Players». El dueño pidió que todo se abra directo por código y
nunca con botones apretados por la página (§71).

**Primer intento:** pedir la sección 0x54 (multijugador en la consola) igual que Single Player (0x48). El juego la
abrió, pero encima salió el cartel «Communication with the controller has been interrupted. Please press the A
Button», y apretar A no lo cerraba.

**Por qué:** se leyó en el código traducido qué hace el botón del menú principal (`MainMenu::OnButtonClick`,
0x8085110C). Los botones 1, 2 y 3 (2, 3 y 4 Players), antes de cambiar de sección:
1. anotan cuál fue (SectionParams +296; el juego lo usa para dejar el cursor ahí al volver);
2. llaman a `MainMenu::ResetSectionParamsAndRacedataScenario1` (0x808516BC) con la cantidad de jugadores, que:
   - no usa la página (pisa `r3` al empezar);
   - deja la cantidad en SectionParams +292;
   - en la ficha de los menús (Racedata +0xC28 + i·0xF0) marca a los jugadores 1 a N como personas y al resto, hasta
     12, como CPU;
   - suelta los mandos de los puestos que sobran (0x8061B7C4 sobre el SectionPad);
3. recién después cambian a la sección 0x54.

El salto directo se saltaba el paso 2. La pantalla de registro veía una ficha que no correspondía y daba al jugador 1
por desconectado.

**El arreglo:**
- `web/juego/directo_nativo.cpp`: si la sección pedida es 0x54, antes del salto se hace lo mismo que el botón
  (SectionParams +296 y la llamada a 0x808516BC con la cantidad de jugadores). La cantidad la fija
  `Module._mkw_directo_locales(n)`, de 2 a 4; si no se dice, es 2.
- `web/navegador/inicio.mjs`: Local abre un submenú **2 Players / 3 Players / 4 Players / Back**, como los botones del
  menú principal del juego. Es un cuarto botón en el mismo panel; en ese submenú no va la línea de ayuda, que ocupaba
  ese lugar. Back, B o Esc vuelven a Multiplayer.
- `web/navegador/mkw.mjs`: «local2…4» pide la sección 0x54 directo, sin cortina como Single Player, con esa cantidad.
  `?directo=0` = el piloto de antes.

**Resultado:** el juego abre directo «Controller Registration», con el mando del jugador 1 ya registrado, las casillas
de los demás y «Press the A Button on the second player's controller». Es la misma pantalla del camino normal; desde
ahí el juego sigue como siempre.

### 84.2 La «100cc» de la sala es 200cc (D1)

En Retro Rewind la cilindrada 100cc del juego corre como **200cc** fuera de las salas mundiales de Nintendo, y la 50cc
como su «500cc» (Pulsar, `Is200cc` en `Race/200ccParams.hpp`, leído solo para entender). La sala del sitio ofrecía
«150cc, 100cc, Espejo, Al azar», con la clave `c100` = la 100cc del juego: la opción «100cc» corría en realidad a
200cc.

Se midió con el juego antes de cambiar nada (`build/web/datos/cc-velocidad.mjs`, solo para mirar). Fue la misma carrera
directa (pista 13.2, CPU normal) con cada cilindrada, y el avance medio de las 11 CPU en el cuadro 1500:

| La sala dice | `engineClass` en la ficha | Avance de las CPU (vueltas) |
|---|---|---|
| 150cc (`c150`) | 2 | 1,1707 |
| «100cc» (`c100`) | 1 | **1,2178**: más rápido que 150cc |
| (`c50`, no está en el sitio) | 0 | 1,2805: el «500cc» |

Una 100cc de verdad sería más lenta que 150cc, así que es 200cc. El arreglo es solo el texto:
- en el sitio (`colabtex/src/juegos/motor.js`, `MKW_CC`), la opción ahora dice **200cc**;
- la clave sigue siendo `c100`, porque las salas guardadas y el marco la usan;
- el sorteo «Al azar» queda igual;
- la CPU de esa cilindrada sigue en «normal», como en un Grand Prix de 200cc de Retro Rewind.

Commit `3fa0816` en Paginita-Pro.

### 84.3 Lo demás del PLAN, revisado

- **D2 (imágenes del juego a R2):** ya estaba hecho. `herramientas/sacar-imagenes.mjs` y `empaquetar-imagenes.mjs` arman
  las imágenes del selector de §74 (fotos de pistas, copas, videítos, planos), y `subir-r2.mjs` las sube con el
  programa. Las caras de los Mii van con M10.
- **C4 (el cuelgue ocasional al empezar la carrera):** no salió en ninguna de las corridas de §83 y §84, más de una
  docena con dos pestañas y varias carreras cada una. Sigue en observación.

### 84.4 Pruebas

| Prueba | Resultado |
|---|---|
| Banco `inicio` | **15/15**, con 1 punto nuevo: el submenú de Local tiene sus 4 botones sin la ayuda, Back y Esc vuelven a Multiplayer, y «3 Players» avisa `local3` |
| `prueba-inicio.mjs` (con el juego) | **14/14**. Multiplayer → Local → 2 Players da sección 0x54, página 0x62 y 2 jugadores en SectionParams +292, sin cartel ni cortina |

```bash
node banco/correr.mjs inicio
node web/navegador/prueba-inicio.mjs
```

**Trampa:** la página activa que lee la prueba es la de más arriba. Con el cartel de «mando desconectado» encima era
0x64 (el cartel); sin él es 0x62 (el registro de mandos). Por eso la prueba pide 0x62 y espera 2,5 s: el cartel salía
un rato después de abrir la sección.

## 2026-10-20 · §85 El aviso de «PC lenta» en prueba-sincro: era la PC, y la prueba pedía cero avisos

**Resumen.** Desde anoche `prueba-sincro.mjs` daba 10/11. El punto que fallaba era «sin avisos de sala lenta»: una
pestaña (casi siempre A) avisaba «Tu PC no alcanza 60 cuadros por segundo (va a 48)». **No es el código de §73–§83:**
el código de §70 (commit `c6c4b89`), compilado hoy en una carpeta aparte, falla igual en esta PC. La carrera de la sala
pesa más que una carrera sola: ~15–17 ms de procesador por cuadro, contra ~9 ms. Esto es a propósito: desde §61–§62
todo se marca «a la vista» y se dibujan todos los cuadros, para que todas las consolas calculen igual. Con 16,7 ms por
cuadro, el margen es de 0 a 2 ms, así que cuánto tienen ocupada la PC los otros programas decide si la carrera va a
52–60 o a 48. En §70 el punto pasaba porque esa noche la carrera iba a 52–55, dentro de la franja en que el aviso no
sale (50–55). Bajo 50, el aviso es **cierto**. El punto ahora pide **avisos ciertos**, no cero avisos: cada «Tu PC no
alcanza» tiene que estar respaldado por el medidor propio de esa pestaña, y no puede salir ningún «espera al jugador».

### 85.1 El síntoma

`node web/navegador/prueba-sincro.mjs` (dos pestañas en el mismo Chrome, la misma carrera sincronizada; §61) daba 10/11
desde la noche del 19 (§83.7). Las huellas coincidían. Fallaba solo «sin avisos de sala lenta»:

- A: «Tu PC no alcanza 60 cuadros por segundo (va a 50): la sala va a tu ritmo». En la primera corrida de hoy, también B
  (46 y 48).
- A terminaba con retraso 12 (el máximo) y B con 2.
- Ya se había descartado (§83.7) que viniera del arreglo de §83 o de la sincronía de tiempo (§80b).

### 85.2 ¿El código o la PC? El mismo código de §70, compilado hoy

La prueba más directa: correr **el código de cuando pasaba** en **la PC de hoy**.

- `git archive c6c4b89 web herramientas banco parches` a `build/viejo-c6c4b89/` (una copia suelta: no toca la rama ni
  `build/web`, que usan las otras sesiones).
- Las carpetas grandes que no cambiaron (`terceros/`, `extraido/`, `herramientas/emsdk`, `herramientas/cache`,
  `banco/node_modules`) entran como **uniones de carpetas** (ver Glosario), sin copiarlas.
- Compilado con su propio `compilar-web.py` (7,5 min: todo desde cero en su carpeta). Las semillas `pipelines.bin` y
  `bloques.json` se copiaron de `build/web/navegador`, para que cargue igual que el de hoy.
- Corrida su propia `prueba-sincro.mjs` (la de §70).

| Código | Cuándo se corrió | Resultado | Ritmo en la carrera (mediana) |
|---|---|---|---|
| §70 (`c6c4b89`) | 18-10, 23:50–23:55 (los registros de entonces, `build/web/datos/c5-normal*`) | **11/11** | 52–55 cuadros/s, 15,6–17,7 ms de trabajo por cuadro |
| §70 (`c6c4b89`), compilado hoy | 20-10, 01:59 | **10/11**: A «va a 47», «va a 43» | 49,6 / 48,5 cuadros/s, 19,9 / 20,0 ms |
| hoy (`cdd2295`) | 20-10, 01:35 | **10/11**: A «va a 50», B «va a 46», «va a 48» | 53,3 / 52,6 cuadros/s, 18,1 / 18,5 ms |

El código viejo falla igual: **la diferencia está en la PC**. Y otro dato de la primera fila: en §70 la prueba ya corría
**bajo 60** (52–55). Pasaba porque el aviso tiene una franja en que no dice nada (ver 85.5).

### 85.3 Cuánto pesa cada carrera: un medidor por proceso

Para saber dónde se va el tiempo armé un medidor aparte (en el borrador de la sesión, no en el repo). Corre la carrera
y, durante 15–20 s de carrera, mide:

- la CPU de cada proceso de Chrome (`SystemInfo.getProcessInfo` de las DevTools);
- el tiempo de CPU del **hilo principal** de cada pestaña (lo da Windows: el hilo que más usa es el del juego);
- el uso de la tarjeta de video (`nvidia-smi` cada 0,5 s);
- un perfil del hilo de la pestaña A (en qué funciones pasa el tiempo).

Todo en la misma PC, con la misma carga de fondo (85.6), uno tras otro:

| Caso | Cuadros/s | Hilo principal ocupado | CPU por cuadro |
|---|---|---|---|
| Una pestaña sola (carrera directa, pista 0.0, sin sala) | 60 | 58–61 % | **~9,5 ms** |
| Dos pestañas **sueltas** (dos carreras directas a la vez, sin sala) | 60 y 60 | 59 % y 59 % | **~9,6 ms** cada una |
| Dos pestañas **en la sala** (la de `prueba-sincro`) | 51–56 | 84–88 % | **15–17 ms** cada una |
| Lo mismo, cada pestaña fija en su núcleo físico (afinidad) | 59 | 81–89 % | 14–15 ms |
| Lo mismo con `&arreglos=0` (sin «todo a la vista» ni «dibujar siempre»; solo para comparar, separa la carrera) | 60 y 60 | 62 % y 86 % | 10–14 ms |

(«CPU por cuadro» = lo ocupado del hilo × la duración de un cuadro: 84 % a 53 cuadros/s son 0,84 × 18,9 ms ≈ 16 ms.)

Qué dice la tabla:

- **Dos juegos en la misma PC no se estorban.** Dos carreras sueltas van a 60, igual que una sola (9,6 contra 9,5 ms).
- **La tarjeta de video no es el cuello.** Con la sala, `nvidia-smi` la marca al 62 % (máx. 71 %, contando los otros
  programas), no al 100 %.
- **No es que Windows reparta mal los núcleos.** Con cada pestaña en su núcleo propio mejora algo (56 → 59), pero cada
  cuadro sigue costando 14–15 ms.
- **Lo que pesa es la carrera de la sala.** El mismo hilo hace más trabajo en cada cuadro. Sin los arreglos de §61–§62
  vuelve a 60.

El perfil dice exactamente qué crece (milisegundos por cuadro, pestaña A):

| Función (mapa de símbolos) | Sola | En la sala |
|---|---|---|
| `ScnMgr::DrawMain` (dibujar la escena) | 2,1 | **6,4** |
| … dentro, `RendererRaceModels::Draw` (los modelos de la carrera) | 1,5 | **5,6** |
| `RaceScene::OnCalc` (la lógica de la carrera) | 3,1 | 4,3 |
| JavaScript de la página (lockstep, red, controles) | < 0,1 | < 0,1 |

El JavaScript de la sala (el lockstep, la malla, los informes) no pesa nada. El tiempo de más está **dentro del juego**,
y casi todo al dibujar.

### 85.4 Por qué: «todo a la vista» y «dibujar siempre»

Son dos arreglos de la carrera sincronizada, los dos necesarios para que la carrera dé igual en todas las consolas:

- **Todo a la vista** (§61, `ClipInfoMgr::Update` en `lockstep_nativo.cpp`). Cada consola mira desde su kart, y el
  juego anota qué objetos ve la cámara. Parte de la lógica usa esa marca: lo que no se ve se actualiza menos. Así cada
  consola calculaba un poco distinto y la carrera se separaba. El arreglo marca todo como «a la vista y cerca», igual en
  todas. El costo: el juego dibuja **toda la pista con todo detalle**, también lo que está detrás de la cámara, y
  actualiza todo como si se viera.
- **Dibujar siempre** (§62, `rr_kamek_81806568`). Retro Rewind se salta el dibujo de un cuadro cuando va atrasado. Como
  cada PC se lo salta en otro momento, la carrera se separaba. En la sala se dibujan todos los cuadros.

Una comparación eléctrica: es como dejar encendidas todas las luces de un edificio para que los sensores de todos los
pisos lean lo mismo. Funciona, pero el consumo sube. Con la carrera sola, este procesador (un Ryzen 7 9800X3D, de los más
rápidos para juegos) usa ~9,5 ms de los 16,7 que dura un cuadro. En la sala usa 15–17. El **margen** queda entre 0 y 2 ms.

### 85.5 Por qué en §70 pasaba: la franja sin aviso

El aviso de §70 (`avisoLento` en `lockstep.mjs`) mira ratos de 3 s y avisa solo si salen mal dos seguidos (6 s):

- si espero más de 4 ms por cuadro y la carrera va a menos de **55**: «espera al jugador N»;
- si casi no espero (< 1 ms) y voy a menos de **50**: «Tu PC no alcanza».

Entre 50 y 55 cuadros/s sin esperar a nadie no sale nada. Es una **banda muerta** (Glosario), como la de un termostato:
no conmuta por cada décima. En §70 la prueba iba a 52–55: dentro de la banda, y el punto pasaba. Hoy va a 48–53:
cruza el 50 un par de ratos seguidos y el aviso sale. Las corridas guardadas muestran cuánto varía la misma prueba:

| Registro (`build/web/datos/…`) | Hora local | A | B |
|---|---|---|---|
| `c5-normal`, `-1`, `-2` (§70, 11/11) | 18-10 23:50–23:55 | 52–55 cuadros/s, 15,6–17,1 ms | 53–55, 15,5–17,7 ms |
| `sincro-directa` (§80b) | 19-10 20:13 | 59,5, 13,7 ms | 59,8, 13,2 ms |
| `sincro` | 19-10 23:47 | 59,9, 14,0 ms | 60,0, 12,9 ms |
| `sincro-lento1` (hoy, 10/11) | 20-10 01:35 | 53,3, 18,1 ms | 52,6, 18,5 ms |

Con la PC tranquila, la sala llega a 60 (13–14 ms). Con la PC ocupada, cada cuadro sube a 18–20 ms.

### 85.6 Qué ocupaba la PC

Medido sin ninguna prueba corriendo (01:30–02:10):

- **Procesador:** 18–28 % de la máquina ocupado por otros programas. El más grande era `TextInputHost.exe` (el teclado en
  pantalla y los emojis de Windows): 65–90 % de un núcleo, todo el tiempo. Parece trabado;
  suele arreglarse cerrándolo o reiniciando la sesión de Windows. Además Opera GX, Discord, Wallpaper Engine (el fondo animado), ExitLag y Kaspersky.
- **Tarjeta de video:** 46–52 % ocupada y 215–232 W antes de abrir el juego. Opera GX usaba 17 % del motor 3D. Discord
  usaba 15 % del **codificador de video**: estaba transmitiendo o compartiendo la pantalla.
- **Otras sesiones:** entre las 02:19 y las 02:27 corrieron a la vez `experiencia.mjs --ventanas 2` (dos ventanas del
  juego), `prueba-experiencia --playlist` (dos juegos más) y pruebas del banco. Con eso, en una corrida `--directa` la
  pestaña A cayó a 1 cuadro/s.

No cerré ningún programa del dueño. Cuánto pesa cada uno no se puede separar sin cerrarlos, pero no hace falta: ya se
ve que la sala no tiene margen y que la carga de fondo cambia de un momento a otro.

**¿A es siempre la lenta? ¿Es por el foco?** No. En la primera corrida de hoy avisaron las dos, y medidas con el medidor
van parejas (A 53, B 52). Tampoco es el foco: la prueba corre Chrome sin ventana (headless) y le apaga el freno a las
pestañas de fondo (`--disable-renderer-backgrounding` y otros dos), y las dos pestañas tienen el mismo ritmo.

A termina con retraso 12 por cómo carga. A abre primero y baja todo de la red; B abre 4 s después y lee de la caché que
llenó A. En el primer segundo de la carrera, A todavía tiene tirones: sus botones le llegan justos a B, y A sube su
retraso a 4, 8 y 12 en un segundo (está en el registro de red: «subo mi retraso a 12 (holgura 0…)»). Es lo de §80,
Trampas: el que se traba queda atrás y paga él su retraso.

### 85.7 El arreglo: el punto pide avisos ciertos

**Lo que cuidaba el punto (§70).** Que no salgan avisos **falsos**: el tirón de la largada (bajar la pista con la caché
vacía) dio una vez «Tu PC no alcanza» con la PC bien. Por eso el aviso pide dos ratos seguidos. Pedir **cero** avisos
también dejaba fuera los avisos **ciertos**, y esos dependen de la PC, no del código.

**El punto nuevo** (`prueba-sincro.mjs`): «los avisos de sala lenta dicen la verdad».

1. Con las dos ya corriendo (etapa ≥ 2, después de la cuenta regresiva) y hasta la última lectura (antes de las fotos,
   que traban un poco la página), la prueba lee el **medidor propio** de cada pestaña. Es la línea que la página escribe
   cada segundo en la consola: «[medidor] N s: cuadro C, F fps, trabajo T ms». Cuenta los cuadros del juego, aparte del
   lockstep: es un voltímetro aparte para comprobar lo que marca el panel.
2. Calcula la mediana de los cuadros/s y del trabajo por cuadro, y el **peor promedio de 6 s seguidos**.
3. Pasa si:
   - no hay ningún «espera al jugador» (con el relevo de §80, en esta prueba nadie espera a nadie);
   - y cada «Tu PC no alcanza» viene de una pestaña cuyo medidor bajó de 50 durante 6 s seguidos. Se acepta hasta 52,
     porque los dos miden en ratos un poco corridos.
4. El detalle muestra siempre el ritmo de cada pestaña. Si alguna va bajo 55, la prueba anota «la PC va justa».

Qué sigue atrapando: un aviso con la PC bien (por ejemplo, el tirón de la largada que se cuela, o una cuenta mal hecha
en `avisoLento`) hace fallar el punto. Y si algo hace esperar de verdad a una pestaña (el relevo que no releva), también.

**Lo que no cambié:** el umbral del aviso. A 48 cuadros/s la carrera va al 80 % de la velocidad, y el aviso «Tu PC no
alcanza» es lo que tiene que ver el jugador.

### 85.8 Pruebas

Con el punto nuevo (todas con `build/web` de hoy, puerto 8190):

| Corrida | Qué más corría | Resultado |
|---|---|---|
| normal, 02:21 | otras dos sesiones con 4 juegos abiertos (`experiencia --ventanas 2`, `prueba-experiencia --playlist`) | **11/11**. Avisos ciertos: A 41 y B 44 cuadros/s (24 y 23 ms por cuadro), lo peor de 6 s 36 y 41 |
| normal, 02:28 | la compilación completa de otra sesión (todos los núcleos) | 10/11. El punto nuevo pasa (lo peor de 6 s: 6 y 3), pero falla «sincronizar cuesta poco»: la PC se trabó hasta 4 s seguidos. Cortada a mano |
| normal, 02:32 | nada más (solo los programas del dueño) | **11/11**. Avisos ciertos («va a 44–49»): A 54 y B 52 cuadros/s, 18,5 y 18,4 ms por cuadro, lo peor 46 y 46. Con el punto viejo habría dado 10/11 |
| `--directa`, 02:34 | nada más | 12/13. El punto nuevo pasa (sin avisos: 59 y 60 cuadros/s, 15,1 y 13,2 ms). Falla «el kart de A avanzó»: ver Trampas (es la C4) |

Lo que no se hizo: correr las pruebas muchas veces con la PC vacía (con los programas del dueño cerrados). No cerré sus
programas, y las otras sesiones necesitaban la PC.


### 85.9 Trampas

- **Las uniones de carpetas se borran hacia adentro.** `build/viejo-c6c4b89/terceros` apunta al `terceros/` de verdad.
  Un borrado recursivo de la copia (`rm -rf`, `Remove-Item -Recurse`) puede entrar por la unión y borrar el original.
  Para limpiar: primero quitar cada unión con `cmd /c rmdir build\viejo-c6c4b89\terceros` (eso quita solo el enlace) y
  después la carpeta.
- **La compilación vieja escribió en la caché de emsdk compartida.** Generó `libc++-legacyexcept.a` y otras librerías del
  sistema en `herramientas/emsdk/upstream/emscripten/cache` (por la unión). Solo suma archivos; el build de siempre no los
  usa.
- **Las medidas de ritmo no sirven si otra sesión corre juegos a la vez.** Las corridas de 02:19–02:27 compitieron con
  hasta cuatro juegos más. Antes de medir: avisar a las otras sesiones y mirar que no haya `node` de pruebas pesadas.
- **El «peor de 6 s» no tiene que incluir la carga de la pista.** Primero medí desde que cada pestaña entra a la sección
  de la carrera, y ahí entran los segundos en 0 cuadros/s de la carga: cualquier aviso parecía cierto. Por eso se mide
  desde que las dos corren.
- **`--directa` puede perder a A en la largada (la C4 del PLAN).** En la corrida de 02:34, A se quedó 5–9 s casi quieta
  justo al largar: era la primera visita, con los pipelines tardando ~4,9 s en llegar y la pista bajando por la red. B
  la esperó el margen y la cortó en el cuadro 20 (§80). El kart de A siguió sin nadie y no avanzó. No tiene que ver con
  este punto; queda anotado en la C4.
- **Dos carreras sueltas a la vez, la primera vez, se trabaron** (B quieta en 0 cuadros/s). La segunda vez, guardando su
  consola, anduvieron bien a 60. No se averiguó por qué; no afecta a la sala.

### 85.10 Lo que queda

**Lo que de verdad importa para lanzar:** la carrera de la sala cuesta ~15 ms de procesador por cuadro **en uno de los
procesadores más rápidos que hay**. Ese costo es de cada consola, no de tener dos juegos en la misma PC. Un PC de un
amigo con un procesador 30 % más lento pasaría los 20 ms y vería «Tu PC no alcanza» en cada carrera. La salida es
dibujar con la vista real **sin** que la lógica vea distinto: separar las marcas de «a la vista» que usa la lógica (todo
igual en todas) de las que usa el dibujo (las de la cámara propia). No es simple, porque el dibujo también escribe cosas
que la lógica lee (§62: las matrices de los modelos). Queda para la etapa de optimizar (Riesgo 11 del PLAN).

```bash
node web/navegador/prueba-sincro.mjs                 # 11 puntos; el de los avisos compara con el medidor de cada pestaña
node web/navegador/prueba-sincro.mjs --directa       # 13 puntos
# el código de §70 en una carpeta aparte (no toca la rama ni build/web)
git archive c6c4b89 web herramientas banco parches | tar -x -C build/viejo-c6c4b89
# + uniones a terceros, extraido, herramientas/emsdk, herramientas/cache, banco/node_modules (cmd /c mklink /J …)
cd build/viejo-c6c4b89 && python herramientas/compilar-web.py --modo navegador && node web/navegador/prueba-sincro.mjs --puerto=8192
```

## 2026-10-20 · §86 Los 6 Mii invitados en «Mi Mii», con las caras que dibuja el juego (M10)

**Qué pidió el dueño** (2026-10-19, «después de implementar el multiplayer al 100 %»): que el menú para cambiar de Mii
de la página ofrezca los **6 Mii invitados** del juego (la pestaña «Guest» de «Elige un Mii»), mostrados con **las
imágenes del propio juego**, no con nuestras caras dibujadas en SVG, que se ven falsas al lado de las de verdad. Al
elegir uno, pasa a ser el Mii del jugador. Se hizo de punta a punta en una sesión aparte (03:10).

### 86.1 Dónde están los invitados (decompilar uno mismo)

La pista era `MiiGroup::LoadDefaultMii` (0x805FA748). Leyendo el C++ traducido (`generated/functions/func_*.cpp`, solo
para entender) y los encabezados de Pulsar (`MiiGroup.hpp`, `MiiManager.hpp`, `Mii.hpp`, `MiiRenderer.hpp`,
`MiiSelect.hpp`), el camino completo es:

1. **La pantalla.** «Elige un Mii» es la página 0x60 (`MiiSelect`). Al armarse (`OnInit`, 0x80847E40) crea un grupo de
   Mii: `new` de 0x98 bytes, `MiiGroup::MiiGroup` (0x805F9E78) y `MiiGroup::Init(10 Mii, textura 0, montón)`
   (0x805FA04C); el montón es el de la escena (GameScene +0xC98; +0xC94 en la sección 0x54). En la pestaña Guest,
   `SetMiiIcons` (0x80848F94) llama a `LoadDefaultMii(i, i)` para i = 0…5.
2. **Los datos.** `LoadDefaultMii` crea el Mii con `MiiManager::CreateDefaultMii` (0x80527F84: un objeto Mii de 0xB8,
   tipo 3 = «por defecto») y `Mii::Load` (0x80526020). `GetRFLArgs` (0x80526460) convierte el tipo 3 en la **fuente 6**
   de la librería de caras («por defecto»), y la librería (0x800CB7E0 → 0x800CB6A0 → 0x800CA800) copia **74 bytes desde
   0x8024C4D0 + 74·i**. Es una tabla dentro del programa (la parte de datos del DOL): 6 Mii con el mismo formato de
   RFL_DB.dat que ya lee `mii.mjs`. Todos se llaman «no name»; A, B y C son chicos, D, E y F chicas.
3. **Las caras.** Al cargarlo, `MiiGroup::AddMii` (0x805FA3FC) se lo pasa a `MiiRenderMgr::AddMii` (0x80781290), que
   dibuja la cabeza en 3D y la **copia a la textura** del grupo (`GXCopyTex`). Medido con el juego: **96×96 en formato
   RGB5A3** (18 KB cada una).

### 86.2 La trampa de aurora: las caras viven en la tarjeta de video

En la Wii, `GXCopyTex` escribe la imagen en la memoria. aurora (el dibujante de WiiCompiled) la deja **solo en la
tarjeta de video** y la usa desde ahí: bajarla cuesta tiempo y casi nadie la lee. Para las que alguien quiera leer,
`GXCopyTex` deja anotado «bajar si la piden» (`efb_ram::schedule`), y al cerrar el cuadro ese pedido se borra
(`efb_ram::cancel`, en `seal_frame_locked`). `aurora_flush_efb_copy_to_ram(dirección)` la baja en el momento: espera a
la tarjeta (con JSPI, la espera del navegador no traba la página) y la escribe en la memoria del juego **en el formato
de la Wii**. Conclusión: la foto hay que bajarla **en el mismo cuadro en que el juego la saca**.

### 86.3 El gancho nativo (`web/juego/invitados_nativo.cpp`)

La página pide (`Module._mkw_invitados_pedir()`) y en el próximo `SectionMgr::Update` de un menú quieto (escena 1, sin
cambio de sección, la sección ya armada; lo llama `directo_nativo.cpp`) el gancho hace lo mismo que «Elige un Mii»:
crea un grupo de 6 con la textura 0, `LoadDefaultMii(i, i)` para los 6, y después de cada uno lee su GXTexObj (ancho,
alto, formato, dirección), baja esa copia y la guarda; al final borra el grupo (`~MiiGroup` con delete, 0x805F9F58).
También copia los 74 bytes de la tabla. Todo queda en una estructura que la página lee (`_mkw_invitados_salida`).

Tres cosas que no salieron a la primera:

| Qué pasó | Por qué | Arreglo |
|---|---|---|
| El juego se detuvo: `OS::Panic eggExpHeap.cpp:174 «DAME DAME»` | El montón de la escena está **cerrado** en medio del cuadro (EGG::Heap +0x1C, bit 0); `ExpHeap::alloc` (0x80226C04) se detiene si le piden memoria. Y `MiiGroup::Init` pide sus listas con `new[]` sin montón (0x80229DF0), o sea al **montón actual**, que en medio del cuadro es otro, también cerrado. La pantalla de verdad crea su grupo mientras se arma, con el de la escena abierto y como actual | Solo mientras se crea el grupo: el montón de la escena se abre y pasa a ser el actual (`EGG::Heap::current`, 0x80386EA0); después todo vuelve a como estaba. Devolver memoria no mira la bandera (`ExpHeap::free`) |
| Ya no se caía, pero salían 0 caras | `MiiGroup::AddMii` dibuja en el acto solo si la sección se está armando (Section +0x38F = 1); con la sección andando deja un **pedido en la fila** del MiiRenderMgr para otro cuadro. Yo lo había leído al revés | Mientras se cargan los 6, la sección se marca «armándose» y después se deja como estaba: las 6 se dibujan y se bajan en el mismo cuadro |
| La primera prueba no llegaba al menú | `?modo=unjugador` solo no abre nada: la página abre «Un jugador» desde el menú de inicio o con `mkwDirecto.ir(0x48)` | La prueba llama `mkwDirecto.ir(0x48)` |

**Lo que cuesta:** ese cuadro tarda **40–52 ms** (dibujar 6 cabezas y esperar 6 bajadas), una sola vez por navegador.
Las 6 se bajaron con el pedido de su propia dirección («bajada 111111»).

**Un tropiezo de convivencia:** la sesión del sonido (E1) enlazó su programa con mi código a medio hacer y su
`prueba-navegador` se cayó con el mismo «DAME DAME». Se le avisó del arreglo. Por eso, con Playwright, la foto
automática de la primera visita va solo con `?invitados=1` (como el menú de inicio con `?inicio=1`): las pruebas que
miden el ritmo no ven ese cuadro largo.

### 86.4 La página (`invitados.mjs`, `textura-gx.mjs`, `editor-mii.mjs`, `directo.mjs`)

- **Pasar la textura a imagen** (`textura-gx.mjs`): decodifica las baldosas de la Wii (I4, I8, IA4, IA8, RGB565,
  RGB5A3, RGBA8, CMPR) a RGBA; las caras se pasan a **PNG** (`OffscreenCanvas`). Si una cara sale vacía (sin tinta: la
  copia no se bajó), se rechaza todo.
- **Dónde quedan:** IndexedDB **de ese navegador** (base `mkw-invitados`): los 6 Mii de 74 bytes y las 6 PNG. Nada de
  esto va a git, al sitio, a R2 ni a la nube (no es parte de las partidas que se exportan o suben): sale del juego que la
  persona ya tiene, en su navegador, como la fuente de §78.
- **Cuándo se sacan:** (1) al abrir «Mi Mii» con el juego andando si no están guardadas (`window.mkwInvitados.sacar()`);
  (2) en la **primera visita**: la licencia nueva se crea con una cara de la página (todavía no hay invitados) y, apenas
  el juego llega a su primer menú, se sacan y **ese Mii toma la cara del invitado** elegido, con el mismo id
  (`mejorarMiiNuevo`): el juego lo muestra desde el próximo arranque (ya leyó la base). `?invitados=0` = nunca
  automático; con Playwright solo con `?invitados=1`.
- **La galería de «Mi Mii»:** los 6 con su imagen («Invitado A…F»). «+ Mii nuevo» crea uno con la cara del invitado y un
  id nuevo (le pones tu nombre). **«Cambiar por un Mii invitado»** le pone la cara del invitado al Mii elegido y le deja
  su id, su nombre y su creador: si es el de la licencia (⭐), la licencia lo sigue encontrando y pasa a usarlo. Un Mii
  con la cara de un invitado se muestra con la imagen del juego; si se le mueve un rasgo, vuelve el dibujo aproximado
  (la imagen ya no sería verdad). Las caras SVG de la página (PRESETS) quedan solo mientras no haya imágenes.
- **La licencia nueva** (`prepararMii`, `directo.mjs`): con la base vacía y los invitados guardados, el Mii nuevo es el
  invitado elegido (el último que se tocó en la galería, `localStorage mkw.invitado`; si no, el A) con el nombre de la
  persona.

### 86.5 Las pruebas

**Banco, sin el juego** (`banco/pruebas/mii-invitados`, datos FALSOS: Mii inventados y caras dibujadas por la página):

```
node banco/correr.mjs mii-invitados
```

**41/41**: texturas de la Wii ida y vuelta (RGBA8 exacta, RGB5A3 dentro de lo que pierden sus bits, RGB565, IA8, I8,
tamaños y orden de las baldosas), lo que deja el gancho leído de una memoria falsa con su misma forma, PNG, cara vacía
rechazada, juego que no pudo, IndexedDB, «cambiar» conserva id/nombre/creador y «nuevo» da id nuevo, `prepararMii` con
el invitado elegido, `mejorarMiiNuevo`, y la galería de verdad (6 imágenes, elegir, guardar, ⭐, el dibujo que vuelve).
Y siguen bien `mii` (11) y `directo` (18).

**Con el juego** (una pestaña, ~3 min; avisar antes a las otras sesiones):

```
node web/navegador/prueba-invitados.mjs
```

**13/13** (03:08, con `MKW_BUILD=build/web-mii/navegador`):

```
✓ el juego dio sus 6 invitados con imagen en el primer menú — 96×96, formato 5, bajada 111111; el juego tardó 51.8 ms en ese cuadro
✓ los 6 Mii son los 74 bytes de la tabla de la librería de caras (0x8024C4D0), uno por uno
✓ son 6 Mii distintos (rasgos distintos) — no name♂, no name♂, no name♂, no name♀, no name♀, no name♀
✓ cada imagen tiene la cara dibujada (más de 20 % con tinta) y las 6 son distintas — tinta 48% 46% 45% 57% 54% 51%
✓ primera visita: la licencia nueva quedó con su Mii y, apenas llegaron los invitados, ese Mii tomó la cara del A (mismo id)
✓ «Mi Mii» muestra el Mii de la licencia con la imagen del juego (el invitado A), no el dibujo
✓ la galería ofrece los 6 invitados, cada uno con su imagen del juego y sin caras dibujadas — 96×96 ×6
✓ guardado: la base de este navegador tiene el Mii de la licencia con la cara del D y el mismo id
✓ al volver a abrir, EL JUEGO carga para la licencia el Mii de la base con lo del invitado D — Prueba ♀ color 2 altura 64 complexión 64
✓ y es el Mii de la licencia: el mismo CreateID
✓ partida nueva con el F elegido: la página lo pone para la licencia («el invitado F»)
✓ y el juego carga para la licencia ese Mii: el de la base con la cara del F, el nombre «Nueva» y su CreateID
✓ sin volver a sacar las caras (ya estaban en este navegador)
```

Cómo se comprueba que **el juego** usa el elegido: después de recargar, el Mii del jugador 1 que cargó el juego
(SectionParams +0x238, su Mii 0) tiene en +0x68 (RFL::AdditionalInfo) el CreateID de la licencia y el nombre de la
persona (es el Mii de la base, no el invitado suelto), y chica/color/altura/complexión del invitado elegido. Las 6
caras y una foto de la galería quedan en `build/web/datos/invitados/` (imágenes del juego: nunca a git). El modo Node
enlaza con las dos funciones vacías nuevas (`aurora_manual.cpp`): `prueba-arranque` **13/13**.

**Trampas de la prueba:** `waitForFunction` de Playwright no espera una función `async` (su promesa ya cuenta como
«verdad»): se pregunta desde Node en un bucle. El `<canvas>` guarda con **alfa premultiplicado**: en los bordes suaves
el PNG vuelve con ±1 (lo opaco y lo transparente, exactos). Y el Mii +0x10 (los 74 bytes crudos) está en cero para un
Mii de la base: hay que mirar +0x68.

### 86.6 Archivos

- Nuevos: `web/juego/invitados_nativo.cpp`, `web/navegador/invitados.mjs`, `web/navegador/textura-gx.mjs`,
  `web/navegador/prueba-invitados.mjs`, `banco/pruebas/mii-invitados/index.html`.
- Cambiados: `web/juego/directo_nativo.cpp` (una llamada en su `SectionMgr::Update`), `herramientas/compilar-web.py`
  (una unidad más), `web/headless/aurora_manual.cpp` (las dos funciones de bajar, vacías en Node), `editor-mii.mjs`,
  `interfaz.mjs`, `directo.mjs`, `mkw.mjs` (`window.mkwInvitados`, la licencia nueva y la primera visita),
  `banco/index.html`.
- Compilado en `build/web-mii/navegador` (taller propio, con los objetos compartidos). El programa del sitio lo toma en
  la próxima compilación final; el kit (`subir-kit.sh`, que copia lo que está en git) lleva los módulos nuevos después
  de este commit.

## 2026-10-20 · §87 La sala de Mario Kart: la playlist arrancaba solo al anfitrión, el cupo sin preguntar y echar

**Qué pidió el dueño:**
1. «chequea el modo playlist, hay un bug de inicio que inicia al host y no a los otros».
2. «al crear partida multiplayer por defecto es para el número máximo de jugadores simultáneos que permite mario kart,
   por lo que no debiera preguntar cuántos players; recuerda la opción de kickear del host y vote kick».

### 87.1 El bug de la playlist: cómo se encontró

**La pista del dueño.** Con `jugar.bat` (el sitio en esta PC, §69) armó una sala en «Modo playlist» con dos cuentas.
En la base de datos de los emuladores quedó el rastro (`build/emuladores/datos`, datos de mentira): la sala se creó en
playlist, el anfitrión empezó (`empieza`), volvió al vestíbulo (`vuelve`), la pasó a copa y empezó otra vez. La copa
funcionaba; la playlist no.

**Primera prueba, sin el sitio.** `prueba-playlist.mjs` (dos pestañas sueltas, §74) dio bien todo el inicio: A arma la
lista, B sugiere, A confirma y las dos eligen personaje. Así que el bug venía de algo propio del sitio.

**Segunda prueba, con el sitio entero.** A `prueba-experiencia.mjs` (la de `jugar.bat`: emuladores de Firebase, el
Worker de verdad, dos cuentas) se le agregó `--playlist`, que hace lo mismo que el dueño: el modo en el vestíbulo,
«¡A correr!», armar una lista de 2, confirmar, elegir y correr. Falló justo ahí:

> ✗ la anfitriona confirma: los dos pasan a elegir personaje (el selector de Piloto Dos se cierra solo) — A elegir ·
> B elegir **selector true**

La sala de B sí pasaba a «elegir», pero **el selector de sugerir seguía abierto encima del juego**. Una persona ve eso:
la anfitriona sigue a elegir personaje y los demás se quedan con el selector tapando la pantalla de personaje.

**La causa.** El selector de pistas (`elegirPista`, `interfaz.mjs`), antes de dar su control a la página (`alAbrir`),
espera los nombres de las pistas (`await nombresPistas`). Con un perfil nuevo no los tiene guardados y los baja por la
red (`indice.json` de las imágenes, por el Worker). Mientras espera llegan más estados de la sala: por ejemplo el VR de
cada uno, que llega desde Firebase y la anfitriona reparte. Cada estado veía `selSug` vacío y abría **otro** selector.
Al confirmar, la página cerraba el único que conocía (el último) y el otro quedaba huérfano. Con dos pestañas sueltas
no pasaba porque comparten el almacenamiento del navegador: B tomaba los nombres que A ya había guardado, sin esperar.
La anfitriona no lo sufría porque su lado marca `pickerAbierto` al instante.

**El arreglo** (`web/navegador/mkw.mjs`):
- Una marca `abriendoSug` que se prende **antes** de esperar nada. Mientras está prendida no se abre otro selector.
- Al quedar armado, el selector revisa si todavía hace falta. Si la anfitriona ya confirmó o empezó otra carrera, se
  cierra solo. Si sigue haciendo falta, toma la lista y las sugerencias más nuevas.
- Lo mismo en los selectores de la anfitriona (la copa, la playlist) y en «+ Agregar pistas», con la marca
  `abriendoEntre`, por si se aprieta dos veces.

### 87.2 La sala nace con el máximo, sin preguntar

La ficha de la sala preguntaba «Pilotos: 2, 3 o 4». Ahora no pregunta nada de eso: toda sala nace con **4**, el máximo
de humanos que admite la carrera sincronizada. Cada piloto es un jugador «local» de verdad en todas las consolas, y el
juego tiene 4 puertos de mando; la CPU completa los 12 lugares. Mario Kart en línea admite 12 humanos, pero eso pide
más que 4 mandos: queda en el PLAN (C9, «más de 4 humanos»). Si algún día se puede, el cupo sube solo, porque sale de
`JUEGOS.mkw.cupo`.

Cómo: en `juegos-main.js` la opción «Pilotos» de Mario Kart queda **oculta** (`oculta: true`, con el máximo como único
valor). Va igual al crear la sala, porque sin ella el cupo quedaba en 2 y el tercero no podía entrar. La ficha
(`salon.js`) ya no dibuja las opciones ocultas. El modo (copa o playlist) se sigue preguntando.

### 87.3 Echar: el anfitrión y la votación

- **El anfitrión** tiene un botón **«Echar»** en la fila de cada piloto del vestíbulo, también con la copa andando.
  Pregunta antes de hacerlo. Es una jugada más del registro de la sala: `{t:"echa", uid, a}`, la misma forma que ya usa
  el torneo de BT3. El reductor de jugadas la convierte en «se fue» (`abandona`, con `echado`) **solo si quien la
  escribe es el anfitrión en ese momento**. Para saber quién es el anfitrión en ese punto del registro, `votacion` le
  pregunta a `redMkw` con el registro hasta ahí. Lo hace en la misma pasada que los votos, así que lo que haga el echado
  después (por ejemplo, votar) ya no cuenta.
- **La votación** (⏏, la de todos los juegos) no aparecía en Mario Kart: el botón exige `est.listos`, y la sala de
  Mario Kart nunca lo tiene (está abierta siempre: vestíbulo y copa). Ahora en Mario Kart se ofrece con **3 o más**
  pilotos. Con 2, votar sería echar con un solo voto, y eso ya lo hace el anfitrión.
- **Lo que pasa al echar a alguien:**
  - el sitio lo saca (`est.fuera`), su marco se cierra y su vestíbulo dice «El anfitrión te sacó de esta sala» (o «…por
    votación»);
  - a los demás marcos el sitio les avisa quién salió (`{tipo:'fuera'}`), y la carrera en curso lo corta al momento
    (`lockstep.saltar`), sin esperar los 2 s de silencio;
  - la sala del juego (`sala-carrera.mjs`, `quitar`) lo deja fuera desde la carrera siguiente, aunque su página siga
    mandando señales.
- No se tocaron las reglas de Firebase: una jugada solo tiene que estar firmada por un jugador de la sala, y `t` puede
  ser cualquier palabra corta.

### 87.4 Pruebas

| Prueba | Resultado |
|---|---|
| `prueba-experiencia.mjs --playlist` (el sitio entero, dos cuentas) | **antes 18/19** (el selector de Dos quedaba abierto), **después 19/19** |
| `prueba-playlist.mjs` (dos pestañas; ahora B como perfil nuevo: sin los nombres guardados y con `indice.json` 3 s más lento) | **18/18** (punto nuevo: B nunca tuvo dos selectores) |
| `prueba-experiencia.mjs` (copa; puntos nuevos: la ficha sin «Pilotos» y echar a Piloto Dos con la carrera andando) | **20/20**: la ficha sin «Pilotos»; Piloto Dos echado en el cuadro 739, cortado en el 744 y la carrera de Uno siguió (cuadro 1027) |
| Banco `sala-carrera` | **49/49** (3 nuevos: `quitar`, y la carrera 2 deja fuera al echado en las tres consolas) |
| Banco `sala-playlist`, `playlist-sala` | 33/33, 25/25 |
| `mkw.test.cjs` (sitio) | **17/17** (prueba nueva: echar y votar) |
| `npm run test:juegos` (todos los juegos del sitio) | 978/979: la que falla es la de las rutas de Windows (`\` contra `/`, §83), de antes |

```bash
node herramientas/prueba-experiencia.mjs --playlist
node herramientas/prueba-experiencia.mjs
node web/navegador/prueba-playlist.mjs
node banco/correr.mjs sala-carrera sala-playlist playlist-sala
cd terceros/Paginita-Pro/colabtex && node --test tests/mkw.test.cjs
```

### 87.5 Trampas

- **`jugar.bat` usa la copia del kit**, no `web/navegador`: el sitio sirve `terceros/Paginita-Pro/juegos/mkw/web/navegador`.
  Un arreglo de la página no se ve en `jugar.bat` hasta copiarlo ahí (`subir-kit.sh`).
- **El ensayo de la prueba ahora usa otros puertos de emulador** (`experiencia.mjs --emu-desplazar 10000`: 19099,
  19000, 19199, 14400, 14500). Así corre aunque el dueño tenga `jugar.bat` abierto (9099, 9000…). El emulador de la base
  (java) a veces sobrevivía al cierre y dejaba su puerto tomado: la prueba ahora cierra lo que quede en esos puertos,
  que son solo suyos.
- **Otras sesiones editan los mismos archivos.** En `mkw.mjs` había cambios sin commit del sonido (§88) y de los Mii
  invitados (§86). El commit lleva solo los bloques de §87: se armó «HEAD + §87» aparte y se agregó con
  `git apply --cached`.
- **Los números de sección** se repartieron entre sesiones para no chocar: §85 la PC lenta, §86 los Mii invitados,
  §87 esto, §88 el sonido con AudioWorklet.
- Una prueba de dos pestañas falló una vez al terminar la carrera 1, porque A se congeló 3 s con la PC muy cargada
  (otras sesiones compilando y probando) y la sala la cortó. Repetida con la PC más tranquila: 18/18.

## 2026-10-20 · §88 El sonido por AudioWorklet: de ~177 ms a ~60 ms del juego al parlante (E1)

**Qué se quería (PLAN E1):** el sonido del juego se oía tarde. Salía por SDL3 con un **ScriptProcessorNode** que pide
bloques de 2048 muestras (43 ms) más una cola de 60 ms en el runtime; la bitácora (§36) lo estimaba en ~100–150 ms entre
que el juego mezcla y se oye, y anotaba cortes en el arranque. La meta: un **AudioWorklet** (corre en el hilo de audio y
deja usar bloques chicos), ~30 ms, sin cortes nuevos. Lo viejo queda con `?audio=viejo`.

### 88.1 Primero medir: un clic de prueba

Antes de cambiar nada hacía falta una regla para medir la demora **de punta a punta**, la misma para los dos caminos.
Es lo que se hace con un pulso y un osciloscopio para medir el retardo de propagación de un cable:

1. El runtime deja el juego **mudo** (todas sus entregas salen en cero) y, en una entrega, pone un **clic**: 4 muestras
   al máximo. Anota la hora exacta (`performance.now()`) de esa entrega (`mkw_web_sonido_marca`, solo para medir).
2. La salida avisa **en qué muestra de la tarjeta** salió el clic: en el camino nuevo lo ve el worklet; en el viejo, la
   página mira cada bloque que SDL3 llenó (el ScriptProcessorNode dice a qué hora de la tarjeta va a sonar ese bloque).
3. `getOutputTimestamp()` del navegador dice qué muestra está sonando **en el parlante** y a qué hora. Con eso, la hora
   en que se oye el clic. **Demora = oído − entrega.** Se repite 8 veces y se toma la mediana (`sonido.medirDemora`).

El juego queda mudo ~3 s mientras se mide. La prueba del navegador lo hace al empezar sus verificaciones, en el título.

**Lo que dio el camino viejo: 177,5 ms** (de 172 a 181), no 100–150. Se reparte así:

| Tramo | ms |
|---|---|
| La cola del runtime (SDL3), que el ajuste de ritmo de §36 lleva a 60 | ~64 |
| El ScriptProcessorNode: un bloque sonando y otro preparándose (1,5 bloques de 42,7 ms en promedio) | ~63 |
| El navegador: su búfer (`baseLatency`, 10 ms) + Windows y la tarjeta (`outputLatency`, 40 ms) | ~50 |
| **Total medido** | **~177** |

Los 50 ms del último tramo **no dependen de la página**: con o sin ventana, y con cualquier `latencyHint` ('interactive',
'balanced', 0,001 s), Chrome en esta PC da siempre 10 + 40 ms (probado aparte con un tono). Lo que sí se puede achicar
son los dos primeros: ~127 ms.

### 88.2 Por qué un AudioWorklet, y por qué con mensajes

- El **ScriptProcessorNode** corre en el hilo de la página, el mismo del juego. Por eso necesita bloques grandes: si la
  página se ocupa más que un bloque, la tarjeta se queda sin muestras. Achicarle el bloque (SDL3 tiene la opción
  `SDL_HINT_AUDIO_DEVICE_SAMPLE_FRAMES`) cortaría con cualquier tirón.
- El **AudioWorklet** corre en el **hilo de audio**, aparte y de prioridad alta. La tarjeta le pide 128 muestras por vez
  (2,7 ms) y él las saca de una cola propia. Si la página se traba, él sigue tocando lo que tiene en la cola.
- ¿Cómo le llega el sonido? Hay dos formas: **memoria compartida** (un anillo en un `SharedArrayBuffer`) o **mensajes**
  (`postMessage`). La memoria compartida necesita que la página esté aislada (COOP/COEP), y el sitio de GitHub Pages no
  lo está (§54); el servidor local tampoco. Así que van **mensajes**: cada entrega del juego (3 ms de sonido, ~330 por
  segundo) viaja como una carta, **transferida** (sin copiar). Cuesta ~20 µs por carta en el hilo de la página
  (0,02 ms por entrega, medido): nada.

### 88.3 El camino nuevo

```
juego → runtime (audio_backend.cpp) → SDL3 solo convierte (32 kHz → 48 kHz, con el ajuste de ritmo)
      → página (sonido.mjs: puente.entregar, una carta por entrega) → worklet (sonido-worklet.js: la cola)
      → 128 muestras cada 2,7 ms → la cadena de siempre (medidor → volumen → medidor) → parlantes
```

- **El runtime** (`audio_backend.cpp`, parche `runtime-web.diff`): al abrir el sonido le pregunta a la página
  (`Module.mkwSonido.abrir()`). Si la página contesta con la frecuencia de su tarjeta, **SDL3 no abre su dispositivo**
  (no crea su AudioContext ni su ScriptProcessorNode): usa un `SDL_AudioStream` suelto que solo convierte, y después de
  cada entrega le pasa a la página lo convertido. Si contesta 0 (`?audio=viejo`, o un build viejo de la página), todo
  como antes. El ajuste de ritmo (el PI de §36) ahora lee la cola **del worklet** y su objetivo.
- **La página** (`sonido.mjs`): `puente.abrir()` crea el AudioContext (el nuestro, con volumen y medidor) y carga el
  worklet; `puente.entregar()` copia el pedazo de la memoria del wasm y se lo transfiere; `puente.nivelMs()` y
  `objetivoMs()` son lo que lee el PI. Mientras el navegador tiene el sonido bloqueado, las entregas se tiran (como
  hacía SDL3); al desbloquearse, el worklet empieza de cero.
- **El worklet** (`sonido-worklet.js`): la cola circular (un FIFO de hasta 1 s) y sus reglas, que son las de un **búfer
  antisaltos** como el de una llamada por internet:
  - **Objetivo de reposo: 25 ms** (`?audioMs=N`). Si la cola se vacía **con sonido** (un corte que se oye) por un tirón
    corto, el objetivo sube lo que faltó + 5 ms (tope 120). Un tirón de más de 100 ms no lo sube (ninguna cola
    razonable lo taparía), ni un vacío en silencio (no se oye).
  - **Empieza alto: 80 ms** (`?audioArranque=N`): mientras arranca, el juego lee el disco y arma pipelines y se traba
    seguido, y la música del título empieza justo ahí. Nadie corre todavía: la demora ahí no importa.
  - **Baja con la calma**: con 3 s **sonando** sin cortes, el objetivo baja un 20 % de lo que sobra por segundo (como la
    descarga de un capacitor), al menos 2 ms/s, hasta el reposo. Pero solo si en los últimos 4 s la cola **nunca bajó de
    8 ms** (en una PC lenta se queda donde no se corta) y si la cola ya lo alcanzó (±15 ms: así el ajuste de ritmo la
    sigue con ~0,3 % y no va al tope). El silencio no cuenta como calma.
  - **Cola vacía**: la última muestra se apaga en ~1,5 ms (sin "clic"), se junta el objetivo y se vuelve con un fundido
    de entrada de 2,7 ms.
  - **Silencio de más**: si sobra cola y lo que viene es silencio, se descarta enseguida (no se oye).
  - **Mucho de más con sonido** (último recurso, casi nunca): salto hasta el objetivo con un fundido cruzado de 2,7 ms.
  - Cada ~21 ms le manda a la página su estado: cola (promedio y mínimo), objetivo, vacíos, huecos, saltos.

### 88.4 Lo que fue apareciendo al medir (y cómo se arregló)

Cada uno de estos se vio en una medición, se entendió y se arregló; cada arreglo tiene su punto en el banco.

1. **La propia prueba trababa la página.** La verificación del final une y recorre todo el registro de la consola
   (~70 ms sin soltar el hilo): con 25 ms de cola, un hueco que no era del juego. Ahora la demora y la foto del medidor
   se toman **antes** de ese trabajo.
2. **El arranque.** Con el sonido sonando desde el principio (`prueba-navegador --sin-bloqueo`), justo cuando empieza la
   música del título el juego va a 36 fps: un hueco que se oye, y el objetivo quedaba en 72 ms por ~25 s. De ahí el
   arranque en 80 ms y la calma que solo cuenta con sonido. Y un vacío **en silencio** ya no sube el objetivo.
3. **El precalentado con caché** (§76: 1.400 pipelines pedidos al llegar al título, justo con la música). En la segunda
   visita el arranque es rápido y callado: el objetivo "se calmaba" en silencio y llegaba chico a la música → 5 huecos
   en una visita de `prueba-musica`. Con la calma solo con sonido: 0 y 0.
4. **Una PC lenta** (`--cpu 2`: Chrome frena el hilo de la página a la mitad): tras un corte el objetivo subía, pero
   volvía a bajar hasta donde se cortaba otra vez (2 huecos en 20 s de carrera). Con la regla del mínimo de 8 ms en los
   últimos 4 s: 0.
5. **El ajuste de ritmo con *windup*.** Mientras el objetivo bajaba, la cola iba atrás y la parte integral del PI
   "aprendía" esa diferencia: el ritmo quedaba al tope (0,6 %) ~10 s y después dejaba la cola 13 ms por debajo del
   objetivo. Ahora, con el worklet, la integral solo aprende cerca del objetivo (|error| < 10 ms: ahí el error es la
   diferencia de relojes, que es lo que tiene que aprender), y la parte proporcional es el doble de firme (10 ms → 0,2 %).
6. **Otro AudioContext de la página se adueñaba del sonido** (ya pasaba antes, sin el worklet). Los pitidos del contador
   DNF (`dnf.mjs`) hacen su propio `new AudioContext()`, y el reemplazo de `sonido.mjs` lo tomaba como "el" del juego:
   desde ese momento **el volumen dejaba de mover el sonido del juego** (movía el de los pitidos) y el medidor medía los
   pitidos. Con el worklet, además, su arranque habría vaciado la cola. Ahora cada AudioContext tiene su cadena (los
   pitidos también respetan el volumen y el silencio) y el del juego es solo el primero.
7. **Otra sesión, otro choque.** Con el árbol de trabajo compartido, mi build enlazó el código a medio hacer de los Mii
   invitados (§86), que se caía al arrancar («OS::Panic … DAME DAME»); las mediciones van con `?invitados=0` y se le avisó
   a esa sesión (que ya lo arregló). Una vez, de 7 corridas en la página real, el juego se cayó cargando la carrera
   («Memory access violation at 0x7E6CA540», primera visita); el cambio de esa corrida (la integral del PI) no toca la
   memoria del juego y no se repitió: queda anotado aparte.

### 88.5 Resultados

**La prueba del navegador** (título, 30 s, la misma compilación, alternando los dos caminos con la PC tranquila):

| | Demora del juego al parlante | Cola | Cortes desde el cuadro 300 |
|---|---|---|---|
| `?audio=viejo` | **177,5 y 177,6 ms** | 37–69 ms | 0 |
| AudioWorklet | **59,8 a 63,6 ms** (4 corridas) | 18–25 ms en reposo | 0 |

**El arranque con sonido desde el principio** (`--sin-bloqueo`): el viejo, 0 huecos y 29 bloques tirados (la cola de
SDL3 llena: cada bloque tirado es un saltito); el worklet, **0 huecos** y 0 tirados (3 vacíos en silencio, que no se oyen).

**La página real** (`herramientas/medir-sonido.mjs`: el sitio como GitHub Pages, **sin COOP/COEP**, el juego en el marco de
Juegos, el Worker de verdad con 50 ms de red, perfil nuevo = primera visita; título 10 s y una carrera de 20 s):

| | Demora título | Demora carrera | Huecos en el título / la carrera |
|---|---|---|---|
| viejo | 176 ms | 170 ms | 0 / 0 |
| AudioWorklet | 70–81 ms (todavía bajando desde los 80 del arranque) | **56–62 ms** | 0 / 0 |
| AudioWorklet, CPU frenada 2× | 84 ms | **51 ms** | 0 / 0 |

En todo el recorrido de una primera visita (incluidas las cargas de los menús, con el disco bajando por la red y el juego
a 8–20 fps) **los dos caminos se cortan**: el viejo 9 huecos + 58 bloques tirados, el worklet 9 huecos y 0 tirados (el
objetivo sube hasta 120 ms en esas cargas y vuelve a ~30 ms a los ~20 s de carrera). El medidor viejo, además, cuenta de
menos: un corte dentro de un bloque de 43 ms no lo ve.

**Lo que tarda la página entre entrega y entrega en la carrera** (lo que la cola tiene que tapar, histograma nuevo
`estado.esperas`): sin freno, 6.578 esperas de menos de 10 ms y 90 de 10–20 ms, ninguna más larga; con la CPU frenada 2×,
5.651 / 855 / 164 de 20–30 ms / 5 de 30–50 ms. Por eso 25 ms de reposo alcanzan en una PC como esta, y en una más lenta
el objetivo se queda solo un poco más arriba.

### 88.6 ¿Y los ~30 ms?

La parte que depende de nosotros (del juego al hilo de audio del navegador) bajó de **~127 ms a ~20–25 ms**: la cola en
reposo (25 ms de objetivo; 18–25 medidos) más medio bloque de 2,7 ms. La meta de ~30 ms se cumple **en esa parte**. El
total medido es ~60 ms porque Chrome + Windows + la tarjeta suman otros ~40–50 ms que una página no puede tocar (probado
con todos los `latencyHint`). En total: **~115 ms menos** (177 → 60), dos tercios de la demora.

### 88.7 Pruebas

- Banco `sonido-worklet` (nuevo, **34 puntos**; necesita el clic, que el corredor aprieta solo): la lógica del worklet
  muestra por muestra con un hilo de audio de mentira (que espere a juntar, el fundido de entrada, la cola vacía sin
  clic, el objetivo que sube lo que faltó, que no suba con un tirón largo ni con un vacío en silencio, la calma, el
  descarte de silencio, el salto con fundido cruzado, la muestra exacta del clic, el arranque alto que baja sin llevar el
  ritmo al tope, la PC lenta) y después de verdad con el AudioContext y un "juego falso" que entrega como el runtime
  (bloqueado se tira todo, el toque desbloquea, nivel exacto, cola cerca del objetivo, volumen, un tirón de 80 ms, la
  demora con el clic, otro AudioContext que no se adueña, pausa y vuelta).
- Banco `sonido` (el camino viejo): **14 puntos** (uno nuevo: otro AudioContext no le quita el volumen al juego).
- `prueba-navegador.mjs 1800`: **22/22** con el worklet y el monitor a 240 Hz; **21/21** en la última corrida, con el
  monitor a 171 Hz (ahí «parejos en pantalla» es una nota). Punto nuevo: «poca demora del sonido: nuestra parte < 40 ms»;
  el de la cola centrada ahora mira el objetivo del worklet. Opciones nuevas: `--puerto`, `--datos` (para correrla al
  lado de otra sesión), `--cpu N` y `--sin-bloqueo`.
- `prueba-musica.mjs`: **11/11** con el worklet (sin cortes mientras se precalienta: 0 y 0).
- `herramientas/medir-sonido.mjs`: la página real, viejo contra nuevo (tabla de arriba).
- El banco entero (`node banco/correr.mjs`): **35 de 35 páginas** bien (el sonido lo usan también la lista de pistas y el
  contador DNF).

```bash
node banco/correr.mjs sonido-worklet sonido
MKW_BUILD=build/web-audio/navegador node web/navegador/prueba-navegador.mjs 1800 --puerto 8175 --datos build/web/datos/audio
node web/navegador/prueba-navegador.mjs 1800 --extra "&audio=viejo"        # el camino viejo, para comparar
node web/navegador/prueba-navegador.mjs 1800 --sin-bloqueo                 # con sonido desde el arranque
node web/navegador/prueba-musica.mjs
node herramientas/medir-sonido.mjs [--cpu 2] [--caminos viejo,worklet]
```

### 88.8 Trampas

- **La página real no está aislada** (sin COOP/COEP): nada de `SharedArrayBuffer`. Los mensajes alcanzan de sobra.
- **Las medidas de tiempo con otras sesiones corriendo no sirven.** Una corrida con `npm run test:juegos` de otra sesión
  dio 21 fps y 7 huecos; se repitió con la PC tranquila, alternando viejo/nuevo para que los dos vieran lo mismo.
- **Playwright no bloquea el sonido** (se simula con `?bloquearSonido=1`): para ver el arranque con sonido hay que usar
  `--sin-bloqueo`. Y con el bloqueo simulado, si el toque llega mientras la página está ocupada, el `suspend()` del
  principio todavía no se aplicó: el desbloqueo ahora reanuda igual.
- **Un tono en la prueba del clic lo confunde** (el umbral es 0,25): por eso el juego queda mudo mientras se mide.
- El arranque alto se nota en el título: ~80 ms al principio, ~25 a los ~20 s de música. Es a propósito.
- `build/web-audio/navegador` (mi build de prueba) lleva un enlace a `build/web/navegador/imagenes`: sin la imagen
  privada no aparece el menú de inicio y `prueba-musica` falla por eso, no por el sonido.

**Lo que sigue:** los tirones de la primera visita (E2: pipelines nuevos) y las cargas de los menús son los que todavía
vacían la cola; con E2 resuelto, también se irían esos cortes.

## 2026-10-20 · §89 El paso 0 de publicar: el programa final, sus semillas y todas las pruebas

**Qué:** el paso 0 de `docs/publicar.md`, lo que le toca a Claude antes de que el dueño suba a R2. Se hizo recién
cuando las tres sesiones que trabajaban en paralelo dejaron su trabajo commiteado: §86 (los Mii invitados, `091b1a1`),
§87 (la sala: playlist, cupo y echar, `e4b5a44`) y §88 (el sonido por AudioWorklet, `4c780a8`). Así el programa final
lleva todo y nada a medio hacer.

### 89.1 El programa final

```bash
python herramientas/compilar-web.py --modo navegador --final --carpeta build/web-m8 --salida build/web-final/navegador
```

- Compilación incremental: **19 de 590** archivos (el runtime del sonido de §88, `invitados_nativo.cpp` de §86,
  `directo_nativo.cpp`, `gx_*.cpp`, `aurora.cpp`). El resto venía del taller `build/web-m8`, del final de §84.
- Resultado: `mkw.wasm` **121,7 MB → 15,7 MB en brotli** (183 s de compresión), `mkw.js` 0,3 MB → 0,1 MB.
- Queda en `build/web-final/navegador`, con las imágenes (`imagenes/`, 94 MB, la del menú de inicio incluida).

### 89.2 Las semillas

Con el programa final servido (`MKW_BUILD=build/web-final/navegador`), tres partidas con `guion.mjs --semilla`. La
semilla de pipelines partió de la de §65 (700) y cada partida le suma lo que usó. La de bloques partió de cero.

```bash
export MKW_BUILD=build/web-final/navegador
cp build/web/navegador/pipelines.bin build/web-final/navegador/     # la de §65 como base
node web/navegador/guion.mjs "-:30000 K~25000:500" --extra "&modo=vs&copa=0&fila=0&cpu=dificil" --semilla
node web/navegador/guion.mjs "-:30000 K~25000:500" --extra "&modo=vs&copa=13&fila=2&cpu=dificil" --semilla
node web/navegador/guion.mjs "-:15000 K:2500 K:2500 K:2500 K:2500 K:2500 -:15000 K~20000:500" --extra "&modo=directa&elegir=1&pistas=5.0" --semilla
```

| Corrida | Qué abrió (foto) | Pipelines | Bloques |
|---|---|---|---|
| 1 | VS 150cc, SNES Mario Circuit 1 (el piloto abre la carrera solo) | 701 | 329 vistos |
| 2 | VS 150cc, GBA Bowser Castle 4 | 707 | 388 vistos, 171 en ≥ 2 corridas |
| 3 | la carrera directa de la sala, con la pantalla de personaje | **713** | **419 vistos, 143 en ≥ 2 (36 MB)** |

Casi no aparecieron pipelines nuevos (13): lo que se dibuja casi no cambió desde §65. En las fotos el kart quedaba
contra la pared, porque el guion solo acelera y no dobla. Para la semilla no importa: cuenta lo que el juego dibujó y
leyó.

### 89.3 Todas las pruebas con el programa final

```bash
MKW_BUILD=build/web-final/navegador node herramientas/correr-todo.mjs
```

**432 bien, 3 mal** en 29 pruebas (~55 min, `build/web/datos/todo/20261020-0401`). Las tres fallas, una por una:

1. **Banco `lockstep`**, «Ana nunca llega: Beto y Carla no se quedan esperando para siempre». Sola: **42/42**. Fue la
   carga: el banco tardó 5 min en vez de 1,5 porque corría junto con lo demás.
2. **`prueba-navegador`**, «la cola del sonido se mantiene centrada»: la cola estaba en 66 ms y el objetivo en 49 ms.
   §88 cambió el sonido: el ajuste de ritmo del worklet centra la cola recién después de unos 20 s, y la planilla
   corría la prueba 15 s (`900` cuadros). E1 la había probado con `1800` (30 s). Con 1800 sobre el programa final:
   **21/21** (cola 27 ms, objetivo 25). La planilla ahora la corre con 1800.
3. **`prueba-nube`**, «sin cuenta (¿se cayó?)»: la prueba **pasó 9/9**. Termina escribiendo «9 ✓ · 0 ✗» y no
   «9 bien, 0 mal», y la planilla no sabía leer ese formato. Ahora lo lee.

Repetidas con la planilla arreglada (`--solo navegador,nube,banco`): **65 bien, 0 mal** (banco 35/35 páginas,
navegador 21/21, nube 9/9). En total, las 29 pruebas con el programa final: **443 bien, 0 mal**.

**El sitio entero con el programa final.** Primero se puso al día el kit con lo commiteado (§86–§88; entre otros
`sonido-worklet.js`, `invitados.mjs`, `textura-gx.mjs`). Después `prueba-experiencia` con `MKW_BUILD`, o sea, el
programa final servido por el Worker de verdad, con las cuentas de mentira y la página de Juegos:

| Prueba | Resultado |
|---|---|
| `prueba-experiencia.mjs` (copa) | **20/20**: el invitado y el Intruso sin el juego, el menú JloKart, la sala de dos, la carrera pareja (huellas iguales), una vista cada uno, echar con la carrera andando (cortado en el cuadro 767) |
| `prueba-experiencia.mjs --playlist` | **22/22**: la playlist arranca a los dos (el selector de Piloto Dos se cierra solo) y lo mismo de la copa |

**La lista para R2** (`MKW_BUILD=build/web-final/navegador node herramientas/subir-r2.mjs`, solo revisar, sin red):
**7.324 archivos, 5,0 GB**, versión `1b6f58d7cad8f4c0`. Lleva `mkw.wasm.br` del final (16 471 831 bytes), `mkw.js`,
`pipelines.bin` (713), `bloques.json` y la imagen del menú de inicio.

### 89.4 Cambios

- `herramientas/correr-todo.mjs`: `prueba-navegador` con 1800 cuadros (30 s) y la cuenta de `prueba-nube`.
- `docs/publicar.md`: el programa final vive en `build/web-final/navegador`; al subir,
  `$env:MKW_BUILD="build/web-final/navegador"`; la lista es de ~7.300 archivos y 5,0 GB.
- Kit del sitio (`terceros/Paginita-Pro/juegos/mkw`) con lo commiteado hasta §88, sin la copia de trabajo de nadie.

### 89.5 Trampas

- **No compilar el final con trabajo a medio hacer en la carpeta.** El compilador toma lo que hay en los archivos, no
  lo commiteado: con §88 sin terminar, el final habría llevado un sonido a medias. Por eso se esperó a las tres sesiones.
- **El kit no se llena con `subir-kit.sh` mientras otras sesiones trabajan.** Ese script copia la carpeta tal como está,
  incluido lo que no está commiteado y `AGENTS.md`. Esta vez se copió desde `git archive HEAD`.
- **`build/web/navegador/mkw.wasm` era de las 01:01**, de antes de §88, y no tiene el worklet. Para probar el sonido
  nuevo hay que servir el final (o volver a compilar `build/web`).

**Lo que sigue:** B7, que es del dueño. Subir a R2 con `MKW_BUILD=build/web-final/navegador` (`docs/publicar.md`,
paso 2), publicar el Worker y las reglas, y probar en el sitio real como amigo y como no-amigo.


## 2026-10-20 · §90 Dónde guarda Retro Rewind sus trofeos y fantasmas, y que quedan guardados (C8)

**Qué:** el punto C8 del PLAN preguntaba dónde guarda Pulsar (el motor de Retro Rewind) los trofeos (`RRSettings.pul`)
y el VR (`RRRating.pul`) cuando se juega en línea. Había que saberlo para no perder nada: si el juego escribe un archivo
en un lugar que la página no copia, al cerrar la pestaña se pierde. La respuesta: **todo va a una sola carpeta**, y esa
carpeta ya se guardaba (§38, `guardado.mjs`). Se agregó una prueba con el juego que lo comprueba de punta a punta.

### 90.1 Lo que se encontró

Retro Rewind tiene su propia carpeta dentro de la memoria interna de la Wii (la NAND), la que Pulsar llama «carpeta
del mod». En la página es `/datos/WiiCompiled/NAND/shared2/Pulsar/RetroRewind6`. Ahí van:

| Archivo | Qué es | Quién lo escribe |
|---|---|---|
| `Trophies/<crc32 de la pista>/Trophy.pul` | El trofeo de esa pista | Pulsar, al **batir al fantasma experto** en Contrarreloj |
| `Ghosts/<crc32>/150/<tiempo>.rkg` y `Ghosts/<crc32>/ldb.pul` | El fantasma de la vuelta y la tabla de mejores tiempos de esa pista | Pulsar, al terminar una Contrarreloj |
| `RRGameSettings.pul` | Los ajustes de Retro Rewind | El menú de ajustes |
| `RRSettings.pul` | Los trofeos **de las versiones viejas** de RR: si existe, Pulsar los pasa al formato nuevo (`Trophies/…`) | Versiones anteriores |
| `RRRating.pul` | El VR de la partida **en línea del juego** («RRRT» y, por perfil, VR/100 como número con decimales) | Solo el modo en línea de RR |

Dos cosas que no eran obvias:

- **En Retro Rewind los trofeos no salen de las copas.** Salen de la Contrarreloj: hay que batir el tiempo del
  fantasma «experto» de la pista. Por eso la prueba es una Contrarreloj y no un Grand Prix.
- **`RRRating.pul` no nos sirve.** Solo lo escribe la partida en línea del juego (Retro WFC), que en nuestras salas no
  se usa (§73). El VR de la sala vive en Firebase (`vr.mjs`, §82). No hay que hacer nada con él.

El nombre de la carpeta de cada pista es el **CRC32** del archivo de la pista (una suma de control, ver glosario): así
Pulsar distingue dos versiones de la misma pista retro.

### 90.2 Por qué ya quedaba guardado

`guardado.mjs` (§38) copia a IndexedDB **toda la NAND**, no una lista de archivos: cuando el juego cierra un archivo
que escribió, la página lo copia medio segundo después. Y `nube.mjs` sube a Storage el mismo paquete
(`guardado.exportar()`). O sea: los trofeos y fantasmas viajaban desde §38 sin que nadie lo supiera. Faltaba probarlo.

### 90.3 La prueba: `prueba-trofeos.mjs` (9 puntos)

Con un navegador sin partidas:

1. Abre una Contrarreloj directo (`?modo=tt&copa=0&fila=0`: Luigi Circuit), espera a que corra y la **termina por
   código** al instante (`Module._mkw_sala_terminar(0)`: el juego cree que cruzó la meta). Un tiempo de un segundo bate
   a cualquier experto, así que Pulsar guarda el fantasma y el trofeo.
2. Recorre el sistema de archivos del juego y busca `Trophies/…/Trophy.pul` y `Ghosts/…`.
3. Mira que estén en IndexedDB y dentro del paquete que sube la nube.
4. Recarga la página y compara una huella (FNV) de cada archivo: tienen que volver con los mismos bytes.

```bash
node web/navegador/prueba-trofeos.mjs            # también en correr-todo (n: 'trofeos')
```

Resultado: **9 bien, 0 mal**. El trofeo quedó en `Trophies/44e5205f/Trophy.pul`; el fantasma en
`Ghosts/44e5205f/150/0m01s168.rkg` (1,168 s, la vuelta «terminada» por código) con su `ldb.pul`. Los tres
llegaron a IndexedDB y al paquete, y volvieron iguales al recargar.

### 90.4 Trampas

- **Los avisos `IOS_Open: FAILED to open …/Trophies/…/Trophy.pul` del registro no son errores.** Al arrancar, Pulsar
  pregunta si existe el trofeo de cada pista; si nunca se ganó, el archivo no existe y el runtime lo anota.
- **Pulsar escribe en una tarea de fondo**, un rato después de la meta. La prueba espera hasta 30 s a que aparezcan
  los archivos, en vez de mirar una sola vez.

**Lo que sigue:** nada para C8. Quedan C9 (más de 4 humanos), C4 y E2.

## 2026-10-20 · §91 Doce jugadores en la sala, como el Mario Kart en línea (C9)

**Qué:** el dueño pidió que la sala soporte 12 jugadores en línea. Hasta aquí cabían 4: en la carrera sincronizada
(§73) cada humano es un jugador local **de verdad** en todas las consolas, y un jugador local necesita uno de los 4
puertos de mando de la Wii. Ahora caben 12: los primeros 4 usan su puerto y del 5.º en adelante cada uno usa un
**mando virtual** (ver glosario). La sala del sitio nace con cupo 12.

### 91.1 De dónde salen los mandos virtuales

Leyendo el juego traducido (regla «decompilar uno mismo»): en Mario Kart en línea los jugadores de otras consolas
tampoco usan un puerto. Cada kart lee sus botones de un **portador** (`ControllerHolder`), y el juego tiene, además de
los 4 de los puertos, **12 portadores virtuales**, uno por puesto de la carrera (`Input::Manager + 0x3B4 + puesto·0x180`):
los usan la CPU y los jugadores remotos.

- El constructor de cada jugador de la carrera (`RaceinfoPlayer`, 0x80533ED8) elige: si el jugador tiene puerto en esta
  consola (Racedata, jugador `+0x6`) usa el portador de ese puerto; si vale −1, el virtual de su puesto.
- `semillas_nativo.cpp` les pone −1 a los humanos 5 a 12 (los mandos de la sala desde `g_mkwPuertos`, que vale 4).
- Los botones de un portador virtual solo cambian con `AIControllerHolder::CopyCPUInputs` (0x805219AC).
  `mandos_virtuales_nativo.cpp` envuelve la actualización de los mandos de cada cuadro (la de Retro Rewind,
  `rr_overlay_805238F0`) y, justo después, llama a `CopyCPUInputs` para cada humano sin puerto con **sus** botones de
  ese cuadro.
- Esos botones pasan al estado que usa el kart con **la misma cuenta del juego** para un mando de GameCube
  (`GCNController::UpdateImpl`): se presta el mando del puerto 4 un instante, con la memoria propia de ese humano, y
  se devuelve tal como estaba. Así el kart responde igual que con un puerto de verdad.
- `pad_web.cpp` y `lockstep.mjs` pasan de 4 a 12 mandos por cuadro (96 números en vez de 32).

### 91.2 Los dos derrames con 5 o más humanos

Con 5 humanos la página se caía al armar la carrera. Con el punto de vigilancia (§62) sobre la dirección que se
corrompía se encontró quién escribía:

1. **La lista de humanos de la IA** (`func_807414B8`). La IA guarda los karts que no son CPU en una fila de **4**
   casillas (`+0x148`, la cuenta en `+0x17C`). El 5.º se escribía en una casilla que ya es otra cosa: un puntero de la
   IA (`+0x168`). Arreglo: una envoltura que no anota humanos pasado el 4.º. La IA solo usa esa lista para mirar a los
   humanos cercanos, y con 4 alcanza.
2. **El armado de pantallas** (`InitScreens`, la copia de RR `rr_overlay_8052F4E8`). Para cada jugador local busca su
   puerto y su tipo de mando. Del 5.º en adelante leía y escribía más allá de los 4 puertos, dentro de los portadores
   de la IA; con 12 humanos se caía. Arreglo: mientras corre, los humanos 5 a 12 figuran como CPU, así no les busca
   puerto ni pantalla. Al terminar vuelven a ser humanos, sin puerto (`+0x5` y `+0x6` = 0xFF) y con el tipo de mando
   del primero.

Las dos envolturas pasan por `REEMPLAZOS` de `compilar-web.py`, como las demás.

### 91.3 Probarlo: `prueba-doce.mjs`

Abre N pestañas (por omisión 6; `--n 12` = la sala llena), cada una como otro PC de la sala, todas en la misma
carrera directa. Cada una acelera y dobla en otro momento. Comprueba los tipos de jugador, los puertos y los
portadores, la cámara, las huellas, que cada kart se mueva con lo suyo, la meta en el mismo cuadro y que ninguna
página se caiga.

```bash
node web/navegador/prueba-doce.mjs --n 5
node web/navegador/prueba-doce.mjs --n 12
```

| Corrida | Resultado |
|---|---|
| `--n 5` | **10/10** |
| `--n 12` | **11/11**: 12 humanos de verdad, 8 con mando virtual alimentado en cada cuadro, huellas iguales en las 12, la meta en el mismo cuadro y los resultados en todas |

Con 12 pestañas en una PC cada juego va lento (la sala va al ritmo del más lento): la prueba cuenta cuadros, no
segundos. `?puertos=N` (solo pruebas) usa menos puertos, así con 2 pestañas también se prueba el camino de los
virtuales.

### 91.4 El sitio

- `colabtex/src/juegos/motor.js`: `cupo: 12` y `MKW_SINCRO_MAX = 12`. Los textos de la portada y de las reglas dicen
  «hasta 12».
- `colabtex/tests/mkw.test.cjs`: el cupo (4 → 4, 12 → 12, 20 → 12) y la sala con 5, 12 y 13 pilotos.
- `juegos-app.js` rearmado con esbuild.

**Trampa:** con más de 4 humanos el juego no puede armar la pantalla partida (no hay puertos para todos). La sala ya
usaba una sola pantalla por consola (§73), así que no cambia nada para el jugador.

## 2026-10-20 · §92 La Contrarreloj contra el mejor fantasma de la página

**Qué:** el dueño pidió que en las carreras individuales contra el fantasma, el fantasma sea **el del mejor tiempo
de la página**. Ahora cada récord nuevo de Contrarreloj sube su fantasma (`.rkg`) a Firebase Storage. Quien elige
«correr contra el fantasma» corre contra el del primero de la tabla de esa pista que tenga uno.

### 92.1 Cómo se hace

- **Subir.** Al terminar una Contrarreloj con récord nuevo (la tabla de la página, `records`), `fantasma-pagina.mjs`
  busca el `.rkg` que Pulsar acaba de escribir en la carpeta del mod (`Ghosts/<crc32>/150/<tiempo>.rkg`, §90). Lo
  espera hasta 15 s, porque Pulsar lo escribe en una tarea de fondo. Lo sube a `mkw/fantasmas/<pista>-tt150/<uid>.rkg`.
  El nombre del archivo trae el tiempo (`1m07s873.rkg`; si el tiempo se repite, `1m07s87a.rkg`): así se elige ESE y
  no otro.
- **Bajar.** Cuando el juego abre la pantalla de fantasmas (la página 0x71), la página pide los 10 mejores de esa pista
  y ese modo. Baja el fantasma del primero que tenga uno (el mejor puede no haberlo subido) y lo deja en la memoria del
  juego (`mkw_fantasma_pagina_poner`).
- **Usarlo.** `fantasma_pagina_nativo.cpp` envuelve `LoadCorrectMainGhost` de Pulsar (`rr_kamek_81814B0C`). Primero
  Pulsar carga el suyo. Si la persona eligió el primer botón (el fantasma experto: estado 9, medido con el juego) y la
  página trajo uno para **esa** pista y **ese** modo, se escribe el de la página encima. Si eligió uno de sus propios
  fantasmas guardados (estado 3), ese manda. El juego corre contra él como contra cualquier fantasma.
- Solo 150cc y 200cc sin pluma (la tabla de la página no distingue la pluma) y solo pistas de Retro Rewind.
- La pista y el modo viven en la memoria de Pulsar (0x818…), más allá de lo que lee la página: los dan dos funciones
  del C++ (`mkw_fantasma_pagina_pista` y `mkw_fantasma_pagina_modo`).
- `?fantasmaPagina=0` = sin esto.

### 92.2 Las reglas de Storage (las publica el dueño)

`firebase/storage.rules` tiene un bloque nuevo, `mkw/fantasmas/{tabla}/{archivo}`:

- leer: con sesión;
- escribir: solo el archivo propio (`<uid>.rkg`), en una tabla con nombre válido (`<pista en hex>-tt150` o `-tt200`),
  de menos de 64 KB, con `customMetadata.uid` igual al uid de la sesión y un tipo que no sea HTML ni JS;
- borrar: solo el propio.

**Hasta que el dueño publique estas reglas, el sitio no puede subir fantasmas.** Mientras tanto la página sigue con el
fantasma experto de RR, sin errores.

### 92.3 Pruebas

| Prueba | Resultado |
|---|---|
| banco `fantasma-pagina` (sin el juego: juego, archivos y nube falsos) | **19/19** |
| `node web/navegador/prueba-fantasma.mjs` (dos navegadores, nube falsa) | **10/10**: Ana corre y sube su fantasma (el mismo `.rkg` de la NAND, byte a byte, con el tiempo del récord). Bea, con las partidas vacías, baja el de Ana; el juego lo usa (estado 9) y en la carrera hay un fantasma con el tiempo de Ana que avanza solo |
| `colabtex/tests/mkw.test.cjs` (sitio) | **18/18**; con `seguridad` y `mkw-worker`, 28 |

**Trampa:** el primer botón de la pantalla de fantasmas es el estado **9**, no el 3 que el código de Pulsar usa para
«cargar el fantasma principal». Se midió con el juego antes de elegir.

## 2026-10-20 · §93 La largada que no corta al que carga (C4) y la primera visita en un solo paquete (E2)

**Qué:** las dos cosas que quedaban de la primera visita. **C4:** en la sala, quien jugaba por primera vez podía quedar
cortado de la carrera justo al largar: su navegador se trababa 5-9 s armando gráficos y leyendo el disco, y los demás
lo esperaban solo el margen de 2 s. **E2:** la primera visita pedía uno por uno ~600 archivos diminutos; lo que no
alcanzaba a llegar, el juego lo esperaba de a uno.

### 93.1 C4: el margen de la largada

En la corrida de §85 (`prueba-sincro --directa`, primera visita), A se quedó casi quieta 5-9 s justo al largar. B la
esperó el margen de la sala (2 s, §80) y la cortó en el cuadro 20: el kart de A siguió sin nadie toda la carrera.

**Arreglo** (`lockstep.mjs`, `margenDe`): en los primeros **600 cuadros** (10 s) de cada carrera, al que falta se le
espera **15 s** (`esperaLargada`; la página lo pone con `?largada=N` s, y `?largada=0` vuelve al margen de siempre). Y
si su página sigue contestando (algo suyo llegó hace menos de 1 s: la pestaña vive, solo espera al disco), hasta
**45 s**, lo mismo que se espera a quien todavía no llega a la carrera. Pasada la largada, el margen vuelve a 2 s: al
que se va de verdad en medio de la carrera no se lo espera más que antes. Mientras se espera, la página dice
«Esperando a jugador 1: su navegador todavía arma la pista (la primera vez tarda). Lo esperamos N s…».

**Banco `lockstep`, 5 puntos nuevos (47/47).** Las consolas falsas ahora pueden trabarse en un cuadro elegido, enteras
(no mandan ni leen nada) o solo el juego (la página contesta):

| Caso (margen 0,4 s; largada 1,5 s, los primeros 100 cuadros) | Resultado |
|---|---|
| trabada 1 s entera en el cuadro 20 | nadie la corta, las tres terminan iguales |
| la misma traba sin el margen de la largada | cortada en el cuadro 23 (lo de antes) |
| el juego espera 3 s pero la página contesta | nadie la corta |
| trabada 3 s entera en la largada (más que su margen) | cortada en el 23, en las dos consolas igual |
| trabada 1 s en el cuadro 200 (pasada la largada) | cortada en el 203 |

**Con el juego: `prueba-sincro --directa --traba-largada=6000`.** La prueba traba la pestaña A entera 6 s (un bucle que
toma el hilo de la página) apenas pasa el cuadro 20 de la carrera.

La primera corrida dio 13/15: nadie se cortó, pero la carrera tardó ~11 s en seguir, no 6. El registro mostró por qué:
**la conexión WebRTC entre las dos se rehízo**. A los 4 s de traba, el buzón de pruebas dio por ida a A (no latía),
y la malla de B cerró la conexión con A, aunque esa conexión seguía sana. Al despertar, A tuvo que volver a ofrecer la
conexión: ~5 s más de carrera quieta.

**Segundo arreglo** (`malla.mjs`, `revisa`): si alguien deja de verse en el buzón pero su conexión directa sigue sana,
la conexión se deja. Se cierra solo si volvió con otra sesión (recargó) o si la conexión también se cayó; y el par
de alguien que ya no está en el buzón, si se cae, se cierra a los 4 s y no se reintenta. Banco `red`, 2 puntos nuevos
(28/28): D calla 6 s en el buzón y C no corta la conexión; cuando D se va de verdad, C lo suelta igual.

Después: **15/15**. La espera más larga de B fue 6007 ms (justo la traba), sin cortes y sin reconexión.

En el sitio la presencia es la de Firebase, que no da por ido a nadie en 4 s; igual conviene que un tirón no corte una
conexión sana.

### 93.2 E2: qué espera la primera visita

E2 decía «los ~9 tirones por pipelines nuevos en 20 s». Eso ya lo resolvió la semilla de pipelines (§65, §89: 713,
precompilados en el título). Lo que quedaba era el disco. Para verlo, una carrera directa con el perfil vacío y la red
del sitio (50 ms por pedido, 50 Mbit/s), con `?trazaDisco=1` (cada lectura que esperó a la red, cuánto y dónde estaba
el bloque):

- en la carga de la carrera y sus primeros segundos, **~50 esperas, ~8 s en total**: las voces y sonidos de los
  corredores (`revo_kart.brsar` y `Character/Sound`), los karts, los íconos del mapa (`Character/Map/*.tpl`), la
  música;
- casi todas estaban **ya en la fila baja**, esperando turno: la fila baja va de a pocas (4 a la vez, una cada 15 ms),
  se aparta mientras el juego carga, y empezaba por los ~600 diminutos, uno por pedido.

Parado en la pantalla de personaje, la fila baja tardaba **~22 s en vaciarse** (739 pedidos en fila a los 12 s; vacía a
los 35 s).

### 93.3 E2: el paquete de los diminutos

`herramientas/diminutos.mjs` junta todos los archivos de ≤ 8 KB del disco y de Retro Rewind (603 archivos, 1,50 MB) en
**un** archivo, `diminutos.bin`: una cabecera, un índice (ruta y tamaño de cada uno) y los contenidos pegados. La
página lo baja apenas lee el manifiesto, en paralelo con el programa. Cada archivo cuyo tamaño coincide con el
manifiesto queda **fijo** en la memoria (`disco.fijar`: no sale nunca, fuera del recambio de 64 MB). Así, ni la fila
baja, ni la carpeta en racha (§76), ni el juego vuelven a pedirlo. Con caché, el paquete sale de Cache Storage.

- `servidor.mjs` y `worker-local.mjs` lo arman al arrancar desde los mismos archivos que sirven: nunca queda viejo.
- `subir-r2.mjs` lo arma y lo sube a `mkw/build/diminutos.bin` con todo lo demás (el Worker ya sirve cualquier
  `mkw/build/…`). Si cambia un diminuto, cambia el paquete y se sube de nuevo.
- Es contenido del juego y de Retro Rewind: **nunca a git**, solo a R2 detrás del Worker.
- `?paquete=0` = de a uno, como antes. Si no está (404) o no es un paquete, la página sigue de a uno, sin error.

| Medida (primera visita, red del sitio) | Antes | Con el paquete |
|---|---|---|
| Diminutos listos | de a uno, hasta ~35 s | **590 a los 6 s** |
| Fila baja vacía (pantalla de personaje) | 35 s | **24 s** (lo que queda es la semilla de bloques, ~36 MB: manda el ancho de banda) |
| Pedidos de la página (pantalla de personaje, 50 s) | 987 | **395** |
| Pedidos al Worker (`medir-sitio`: menús → carrera de 20 s) | 2531 | **1363** |
| Tirones en esos 20 s de carrera | 3 (peor 37 ms) | **1 (29 ms)** |

Menos pedidos también es menos trabajo para el Worker y para R2, que cobran por pedido.

**Banco `disco`, 5 puntos nuevos (38/38):** leer un paquete inventado (rutas y bytes en orden), un paquete cortado o algo
que no es un paquete da error, los fijados se leen sin red y ni la fila baja ni la carpeta los piden, siguen ahí
aunque la memoria se recambie, y `fijar` no acepta lo que pasa de un bloque. `prueba-subir-r2.mjs`: el paquete va en la
lista con los de ≤ 8 KB y sin los grandes, y cambiar un diminuto sube también el paquete (23/23).

### 93.4 Lo que se probó y no sirvió

**Subir la fila baja a la normal al entrar a la carrera.** La idea era que lo que espera en la fila baja (las voces de
los CPU, los sonidos de la carrera) es justo lo que la carrera va a leer, así que convenía pedirlo todo de una vez. Fue
peor: menos esperas (13 contra 32), pero más largas (7,2 s contra 4,7 s en total). Todo eso a la vez llena los
50 Mbit/s, y las lecturas del juego quedan detrás. Se sacó.

### 93.5 Lo que queda

Una carrera abierta **directo** a los 15 s de abrir la página (sin pasar por los menús), en la primera visita, todavía
espera ~4,7 s al disco en sus primeros segundos: la fila baja no alcanzó a vaciarse. En la sala no pasa así, porque
antes de cada carrera están la pantalla de personaje (hasta 45 s) y los menús. Y si pasa, la largada de 15 s (93.1)
hace que nadie quede cortado.

En esta PC las pruebas usan HTTP/1.1, con 6 conexiones por servidor. El sitio real va por HTTP/2 o HTTP/3 (Cloudflare),
con todos los pedidos por una conexión: ahí cada espera debería ser más corta que aquí.

### 93.6 Trampas

- **No medir con otra cosa corriendo.** La primera medición con el paquete dio 15 tirones (peor 716 ms), y la de
  comparación, sin el paquete, solo 3. Durante la primera estaba corriendo el banco del disco en otro Chrome. Sola dio
  1 tirón.
- **El buzón falso de pruebas da por ido a quien no late en 4 s.** Cualquier prueba que trabe una pestaña más que eso
  pasaba por la reconexión de WebRTC (93.1).

### 93.7 El programa final con todo (§90–§93) y todas las pruebas

El final recompilado con todo lo de hoy (C9, el fantasma de la página, la largada): `python herramientas/compilar-web.py
--modo navegador --final --carpeta build/web-m8 --salida build/web-final/navegador` (4 min; 592 unidades;
`mkw.wasm.br` 15,7 MB). Las semillas de §89 siguen sirviendo: no cambió lo que se dibuja ni lo que se lee.

```bash
MKW_BUILD=build/web-final/navegador node herramientas/correr-todo.mjs
```

**492 bien, 0 mal** (33 pruebas, ~55 min; detalle en `build/web/datos/todo/20261020-1549`). Entre ellas las nuevas:
`doce` 11/11 (6 humanos, 2 con mando virtual), `fantasma` 10/10, `sincro-largada` 15/15 y `trofeos` 9/9; y el banco
completo (36 páginas), el sitio (24) y `subir-r2` (23).

**Lo que sigue:** lo del dueño (B7): publicar las reglas de Storage nuevas (los fantasmas, §92), subir a R2 con
`MKW_BUILD=build/web-final/navegador` (ahora también sube `diminutos.bin`) y probar en el sitio real.

## 2026-10-20 · §94 El descanso entre carreras, el VR a la vista y la parrilla de Mario Kart

**Qué pidió el dueño:**

1. Entre pista y pista del multijugador, **30 s de descanso** «para que hagan todo».
2. Si en el descanso alguien agrega o sugiere una pista y a la cuenta le quedan **menos de 15 s**, la cuenta **vuelve a
   15 s**.
3. El **VR** no se veía en el modo playlist.
4. Como en Mario Kart, cada uno **larga la carrera siguiente en el puesto en que llegó** a la anterior.

### 94.1 El descanso de 30 s y la regla de los 15 s

Antes, entre carreras había 9 s de resultados (`SEGUNDOS_RESULTADOS`). En la playlist, «+ Agregar pistas» **congelaba**
la cuenta hasta 60 s, y al cerrarlo quedaban 3 s.

Ahora (`sala-carrera.mjs`):

- **30 s de descanso** en las dos salas (copa y playlist). `?descanso=N` (segundos) cambia el valor, solo para pruebas.
- Si la playlist gana **una pista** o **una sugerencia nueva** y a la cuenta le quedan menos de 15 s, el plazo pasa a
  ahora + 15 s (`alargue`). Con más de 15 s no cambia nada: no se acumula.
  - «Gana una pista» = la lista tiene más pistas que antes: el anfitrión agrega una, o acepta una sugerencia.
  - «Sugerencia nueva» = sube el número de la próxima sugerencia (`sig`).
  - Reordenar o sacar pistas no cuenta.
- **Abrir «+ Agregar pistas»** también cuenta como empezar a agregar: si quedan menos de 15 s, vuelve a 15. Ya no
  congela nada.

Es como un monoestable redisparable: cada disparo nuevo asegura al menos 15 s, y nunca suma más que eso.

**La hora de la anfitriona.** El plazo es una hora del reloj de la anfitriona. El reloj de cada PC no da exactamente la
misma hora: con 5 s de diferencia, la cuenta de un jugador decía 5 s distinto que la de otro. Ahora:

- cada reparto del estado lleva la hora de ella (`reloj`);
- cada página anota la diferencia con su propio reloj (`desfase`);
- `sala.restan(plazo)` da lo que falta igual en todos.

Lo usan el contador de «elegir» (45 s) y el del descanso.

### 94.2 El panel del descanso (y el VR que no se veía en la playlist)

**Por qué no se veía el VR en la playlist.** El VR se calculaba bien en las dos salas (§82), pero se mostraba solo como
un aviso de una línea arriba de la imagen («🏁 VR 5000 → 5013 (+13)»). En la playlist, al mismo tiempo se abría el
panel de las pistas, y abrir «Sugerir pista» borraba los avisos (`ui.aviso('')`). El aviso duraba un instante o no
salía.

**Ahora** el panel de entre carreras (`playlistBreve` de `interfaz.mjs`) es el panel del descanso de **las dos salas**:

- arriba, la cuenta: «La carrera siguiente en 27 s» (en la última: «La copa termina en…»), amarilla en los últimos 5 s;
- **los resultados de la carrera**, por puesto: cada humano con su puesto, los puntos de la copa y su VR (antes →
  después, verde si sube y rojo si baja), con «(tú)» marcado;
- en la playlist, además, lo que viene con «+ Agregar pistas» (anfitrión) o «Sugerir pista» (los demás); en la copa,
  lo que queda de la copa y sin botones.

De dónde sale cada dato (`resultadosDe` en `mkw.mjs`):

| Dato | De dónde |
|---|---|
| Puesto y puntos | De la sala: la llegada (94.3) y la tabla de puntos (§75), iguales en todas las consolas. Así también los ve quien recargó y no corrió esa carrera |
| VR | Lo calcula cada página al terminar la carrera (§82: `cambiosVr` da el cambio de **todos**, con los mismos números en todas las consolas). Quien no corrió la carrera ve el VR que cada uno le avisó a la anfitriona |

### 94.3 La parrilla, como en Mario Kart

**Lo que hacía el juego.** Primero se midió (regla «decompilar uno mismo»): una carrera directa, terminada por código,
leyendo antes y después la ficha de cada jugador en Racedata.

- En la ficha de cada jugador, el byte **`+0xE1`** es el «puesto anterior». En la primera carrera,
  `escribirFicha` (`directo_nativo.cpp`) lo pone como hacen los menús del juego: 12, 11, …, 1 (los humanos atrás).
- Al terminar la carrera, el juego deja en la ficha **de los menús** el puesto de llegada (`+0xE2`) y los puntos
  (`+0xDA`), y nada más. El «puesto anterior» de la carrera siguiente lo escribe el menú del juego entre carrera y
  carrera (en el código traducido, las funciones que escriben `+0xE1` son dos «setters» de Racedata, 0x8052E640 y
  0x8052E658, y dos de los menús, 0x80707534 y 0x806CCA04). En la sala ese menú no pasa: la carrera siguiente se abre
  directo. Por eso, desde la segunda, todos largaban siempre igual que en la primera.

**El experimento que lo confirmó** (`node herramientas/medir-parrilla.mjs`): carrera 1 → terminarla → escribir `+0xE1` a mano con un orden
inventado (el humano 6.º, los CPU 1.º a 5.º y 7.º a 12.º) → abrir la carrera 2. En la cuenta regresiva, los puestos del
juego (`RaceinfoPlayer +0x20`) eran **exactamente** los escritos (6 1 2 3 4 5 7 8 9 10 11 12). Con el humano en 1.º, la
foto lo muestra adelante de todos, con «1st» en la pantalla. El juego no lo copia solo: la llegada de la carrera 1
era otra.

**El arreglo** (todo en la página, sin tocar el C++):

1. Al terminar cada carrera, cada página manda a la anfitriona, junto con sus puntos, **la llegada**: los 12 puestos de
   su consola (`llegadaDelJuego`: `RaceinfoPlayer +0x20` con la carrera terminada; 0 donde no hay nadie).
2. La anfitriona guarda en el estado la primera que le llega (`llegada: {carrera, puestos}`): todas las consolas que
   corrieron la carrera tienen la misma (es la misma carrera, cuadro por cuadro).
3. Antes de abrir la carrera n (n > 1), cada consola escribe esa llegada como «puesto anterior» de cada uno
   (`ponerParrilla`, en la ficha de los menús). Si no la hay o no sirve (puestos repetidos), escribe la de la primera
   carrera. Así **todas las consolas largan igual**, condición para que la carrera sincronizada siga siendo la misma
   en todas. Incluida la que recargó la página y no vio la carrera anterior: la llegada viene de la sala.

### 94.4 El menú del juego que se colaba en el descanso

Con 9 s de resultados casi no pasaba, pero con 30 s pasaría seguido. Se midió apretando A cada 1,5 s después de una
carrera (`node herramientas/medir-resultados-a.mjs`):

| Tiempo | Pantalla del juego |
|---|---|
| 0-3 s | la carrera terminada (página 0x0E) |
| 4-6 s | los resultados (0x2F) |
| 7-9 s | la tabla de puntos (0x30) |
| **11 s** | **el menú de «carrera siguiente» del juego (0x22)** |
| 12-18 s | la sección 0x4B: el juego elige pista solo |
| 21 s | **otra carrera**, fuera de la sala |

En la sala eso deja a esa consola en otra carrera, sola. **Arreglo: el cerrojo** (`controles.cerrojo` en
`controles.mjs`, puesto por la sala en `mkw.mjs`). En cada cuadro pregunta si la carrera ya terminó (Raceinfo, etapa
≥ 4) y en qué pantalla está el juego. Fuera de la carrera y de sus resultados (0x0E y 0x2F), los botones de la persona
no llegan al juego. Se puede mirar la tabla de puntos, pero no salir de ella. Durante la carrera manda la carrera
sincronizada, como siempre.

### 94.5 Pruebas

| Prueba | Resultado |
|---|---|
| banco `sala-carrera` | **64/64** (15 nuevos: 30 s de descanso, la llegada en el estado y repartida, la primera queda, una con puestos repetidos no; la misma cuenta con relojes +7 s y −4 s; `llegadaDelJuego` y `ponerParrilla` con una memoria falsa: la llegada, la de la primera si no hay, con 3 corredores) |
| banco `sala-playlist` | **37/37** (los de la pausa de 60 s pasan a la regla nueva: abrir el selector con 30 s no cambia nada; agregar con 12 s → 15; reordenar no; sugerir con 7 s → 15 en las tres; abrirlo con 4 s → 15; sin agregar nada, la siguiente a los 30 s) |
| banco `playlist-sala` | 25/25 (sin cambios) |
| `prueba-elegir.mjs` | **69/69** (4 nuevos: el panel de la copa sin botones con la cuenta, los resultados por puesto con puntos y VR, «(tú)», la última «La copa termina en 3 s» resaltada) |
| `prueba-sala.mjs` | **35/35** (5 nuevos: el panel en las dos —«La carrera siguiente en 21 s», los dos con puesto, puntos y VR +13/−13—; B aprieta A 10 veces en los resultados y el juego no pasa de la tabla de puntos —solo 0x2F y 0x30—; la cuenta al aparecer el panel, más de 28 s en las dos; la parrilla de la 2 = la llegada de la 1 en las dos; y en la cuenta regresiva el juego larga en ese orden: A, que llegó 2.ª, larga 2.ª con B adelante) |
| `prueba-sala.mjs --recarga` | **34/34** (los 2 nuevos de la parrilla: B, que recargó y no corrió la 1, larga la 2 con la misma parrilla que A, sacada de la sala) |
| banco entero (`node banco/correr.mjs`) | 36 de 36 páginas bien |
| `prueba-playlist.mjs` | **20/20** (sin los 2 de la pausa vieja; 4 nuevos: el panel con la cuenta y el VR de los dos; con el selector abierto la cuenta baja igual —11,6 s—; A acepta la sugerencia de B y la cuenta vuelve a 15 s en las dos —14,3 s en A y en B—; cerrar el selector no adelanta nada: la 2 abre 14,7 s después) |

### 94.6 Trampas

- **Los puestos de la etapa 0 no son la parrilla.** En el primer cuadro de la carrera (etapa 0) el juego todavía no
  calculó los puestos y muestra 1, 2, …, 12 en orden. La primera versión de la prueba los leyó ahí y falló. La parrilla
  se ve en la cuenta regresiva (etapa 1): la página la anota ahí (`mkwEstado.parrilla.largada`).
- **Medir el descanso desde la prueba no sirve.** Restarle a mano lo que tarda la prueba en ver el fin daba 27 s. Ahora
  la página anota lo que faltaba al aparecer el panel (`mkwEstado.descanso.restanAlAbrir`).
- **`toLocaleString('es')` no pone punto en los números de 4 cifras** (5013, no 5.013; sí 12.345). La prueba del panel
  compara con lo que da el mismo navegador.
- **«Tu PC no alcanza 60 cuadros por segundo», a veces.** En 3 de 6 corridas de `prueba-sala` (con o sin `--recarga`)
  falló un punto viejo: «ningún aviso de la página queda encima de la carrera». Con dos juegos en la misma PC cada
  pestaña va a 40-60 cuadros por segundo, y si en el instante del control va por debajo, sale el aviso de lentitud de
  §80. Para descartar que fuera por estos cambios se corrió la prueba con el código de antes (una copia de `HEAD` con
  `git archive`) y con el de ahora, una detrás de otra: las dos pasaron. Lo único nuevo que corre en cada cuadro es el
  cerrojo (dos lecturas de memoria, menos de un microsegundo). El aviso es justo: la PC de verdad no daba 60.

## 2026-10-20 · §95 El VR con el puesto general (las CPU cuentan)

**Qué pidió el dueño:** «que el VR dependa de la posición general incluyendo a los bots, pero con más peso respecto a
jugadores reales; piensa bien en un buen sistema de cálculo e implementalo, usa un crítico externo para que evalúe tu
cálculo matemático».

Hasta §82 el VR de la sala usaba la regla exacta de Mario Kart Wii, **solo entre humanos**. En una sala de 2 humanos y
10 CPU, llegar 1.º o 2.º daba lo mismo si el otro humano llegaba 12.º. Ahora cuenta el puesto entre los 12.

### 95.1 La regla

Todo está en `web/navegador/vr-sala.mjs` (`cambiosVr`, `REGLA_CPU`).

1. **Entre humanos, lo mismo de §82**, sin tocar: cada par (el que llegó antes gana `puntosPar(VR ganador, VR
   perdedor)`, el otro pierde lo mismo), en enteros, de suma cero. El cortado pierde contra todos y nadie gana por él.
2. **Cada CPU es un rival de VR fijo**, el **ancla** de su nivel (el de la ficha de la carrera, igual en todas las
   consolas):
   - difícil (150cc y espejo) = **5000**, el VR con que empieza todo el mundo: quien le gana a la mitad de las CPU
     difíciles se queda en 5000;
   - normal (100cc) = **3000**;
   - fácil = **no cuenta** (no hay fáciles en la sala hoy; se dejó por si acaso).
3. **Contra cada CPU**, con el VR del humano `v` y el ancla `A`:
   - si el humano llegó antes: suma `puntosPar(v, A)`;
   - si la CPU llegó antes (o el humano se cortó): resta `puntosPar(A, v)`.
   Es la curva del juego, como si la CPU fuera un humano de VR `A`.
4. **El peso**: lo de las CPU se suma entero (S) y se escala **una sola vez**:

   ```
   parte de las CPU = trunc( 2·S / max(8, n) )      n = cuántas CPU corren
   ```

   - con hasta 8 CPU: S/4 → cada CPU vale **1/4 de un humano**;
   - con 9, 10 u 11: 2·S/n → **todas juntas valen 2 humanos** (el tope).
   - `trunc` = cortar los decimales hacia el cero (como el juego con sus puntos). Todo en enteros: da lo mismo en todas
     las consolas.
5. El cambio de cada humano = lo de los humanos + lo de las CPU. Se aplica con los topes de siempre (de 1 a 1 000 000).
6. Sigue haciendo falta que corran **al menos 2 humanos** para que haya VR (es la sala «en línea»).

**Ejemplos** (todos con VR 5000, 2 humanos y 10 CPU difíciles; contra uno de igual VR cada par vale 13):

| Llegada | Cambio |
|---|---|
| 1.º (el otro humano 12.º) | 13 (al humano) + trunc(2·10·13/10) = 13 + 26 = **+39** |
| 12.º (el otro humano 1.º) | −13 − 26 = **−39** |
| 2.º, detrás del otro humano (1.º) | −13 + 26 = **+13** (y el 1.º, +39) |
| 11.º, delante del otro humano (12.º): las 10 CPU llegaron antes | +13 + trunc(2·(−10·13)/10) = 13 − 26 = **−13** (y el 12.º, −39) |

### 95.2 Por qué el ancla es fija (y no el VR de los humanos)

El VR es un **lazo realimentado**. Cuanto más VR tiene uno, menos le da ganarle a una CPU (la curva baja cuando el
rival tiene menos VR) y más le quita perder. Así el VR de cada uno va a un **punto de equilibrio**: donde lo que gana
en promedio iguala a lo que pierde.

Con el ancla fija, ese punto existe y depende solo de lo bien que juega cada uno. El crítico lo calculó con la curva
del juego (con los puntos truncados), y una simulación de 6000 carreras con el código de verdad da lo mismo:

| Le gana a cada CPU difícil… | El VR se queda en… |
|---|---|
| 10 % de las veces | ~1770 (5000 − 3233) |
| 25 % | ~3500 (5000 − 1476) |
| 50 % | **5000** |
| 70 % | ~6170 (5000 + 1169) |
| 80 % | ~6820 (5000 + 1820) |
| 90 % | ~8200 (5000 + 3234) |
| siempre | ~11 600 (5000 + 6599): ahí ganarle a una CPU ya da 0 puntos y no sube más |

Si en cambio el ancla fuera «el VR medio de los humanos de la sala», la referencia se movería con la salida: todos
suben, el ancla sube, y vuelven a subir. **Inflación sin fin** (el crítico lo mostró en simulación). Por eso el ancla es
un número fijo, como la tensión de referencia de un regulador: no depende de lo que regula.

### 95.3 El crítico externo

Se le pasó a un agente aparte (sin esta conversación) el diseño escrito y el código, con cinco preguntas: ¿están bien
las cuentas?, ¿el peso?, ¿las anclas?, ¿cómo se puede abusar?, ¿casos borde? Recalculó todo, simuló miles de carreras
y salas y contestó. **Lo que encontró y lo que se hizo:**

1. **Las cuentas del diseño estaban bien**, salvo un ejemplo: el 11.º con las 10 CPU delante, con el peso del borrador
   (1/4 por CPU, sin tope), daba 13 − trunc(32,5) = **−19**, no −13 como decía el borrador. Con la regla final es −13 (la
   tabla de 95.1), y el banco lo comprueba.
2. **El peso no cambia el equilibrio, solo la velocidad y el ruido.** Con peso 1/4 por CPU y 10 CPU, las CPU pesaban
   2,5 humanos y el único rival humano, 1: el VR se movía mucho por las CPU (desviación ~27 por carrera contra ~17 con
   un tope). Recomendó un **tope** para todas las CPU juntas. → **Se puso tope 2 humanos** (el crítico proponía 1 o
   1,5). Con 1 las CPU casi no se notaban (1.º +26, 2.º detrás del humano 0): el dueño pidió que el puesto general
   importe. Con 2 un humano sigue valiendo 4 veces una CPU y todas las CPU juntas, a lo más 2 humanos.
3. **Las CPU fáciles no pueden contar.** A una CPU fácil casi todos le ganan siempre, y quien gana siempre sube hasta el
   ancla + 6599. Con el ancla de las fáciles (2000) eso era VR regalado. → **Las fáciles no cuentan**; la normal bajó
   de 3500 a **3000** hasta tener datos de verdad (un ancla alta se aprovecha; una baja solo cuesta un poco de VR en
   100cc).
4. **Congelar la regla.** Si la anfitriona y un invitado tuvieran páginas de versiones distintas (una con otra ancla),
   cada consola contaría otro VR. → La anfitriona pone la regla en la foto de la carrera (`vrCarrera.cpu`, junto a los
   VR) y todas cuentan con esa (`reglaCpuDe` en `sala-carrera.mjs`). Si la que llega está rota, cada una usa la suya.
5. **Puestos que no se pueden creer.** Si el juego no da el puesto de una CPU (0), esa CPU quedaba «detrás de todos» y le
   regalaba hasta 26 a cada humano. → Si alguna CPU no tiene puesto, o hay puestos repetidos o fuera de 1 a 12, la
   parte de las CPU no se cuenta (el cortado igual pierde contra todas).
6. **Un humano sin puesto = cortado.** Antes (§82) un humano sin puesto quedaba detrás de todos y los demás ganaban por
   él. → Ahora cuenta como cortado: pierde contra todos y nadie gana por él (como si se hubiera ido).
7. **La granja de VR se arregla sola.** Con §82, una persona común con una cuenta alterna siempre última (renovada cada
   200 carreras) llegaba de 5000 a **10 483** en 2000 carreras. Con §95: **5340** (y 7037 alguien que le gana al 80 %
   a cada CPU, cuando jugando honesto se queda en ~6820). Lo que cuenta son las CPU, y contra ellas no hay a quién
   sacarle VR.

### 95.4 Cómo viaja en la página

- `sala-carrera.mjs`: `congelar(n)` = `{ n, vrs, cpu: REGLA_CPU }` al empezar cada carrera. `reglaCpuDe(estado, n)` = la
  regla de esa carrera (o nada, si la foto es de otra).
- `vr-sala.mjs`: `corredoresDelJuego` lee también las CPU de la carrera (tipo 1 en el escenario) con su puesto final
  (`RaceinfoPlayer +0x20`): `{ cpu: true, puesto }`. `cambiosVr(corredores, { nivelCpu, regla })`; `peorCaso` igual.
- `mkw.mjs`: al abrir la carrera, el peor caso (perder contra el otro humano y contra todas las CPU) queda guardado,
  como en §82. Con 2 humanos y 10 CPU difíciles: 5000 → 4961 (con normales, 4935). Al terminarla, el de verdad.
  `mkwEstado.vr` lleva `nivelCpu` y `regla` para las pruebas.

### 95.5 Lo que se vio en el juego

`prueba-sala.mjs` (dos pestañas, la copa de 2 humanos + 10 CPU, a 100cc: CPU **normales**, ancla 3000):

- al abrir la carrera 1 las dos guardaron su peor caso, **4935** (perder contra el otro humano, −13, y contra las 10
  CPU normales, −52: con 5000 contra un ancla de 3000, perder cuesta 26 por CPU);
- carrera 1: B 1.º, A 2.º. **B 5000 → 5025 (+25)** = +13 por A y +12 por las CPU. **A 5000 → 4999 (−1)** = −13 por B
  y +12 por las 10 CPU que le ganó. Ganarle a una CPU de 3000 con 5000 da solo 6 puntos (×2/10 por las 10 = +12);
- la foto de la carrera 2 llevó los VR nuevos (4999 y 5025) y la regla, la misma en las dos;
- carrera 2: A 1.º → 5024 (+25); B 12.º → **4960 (−65)** = −13 por A y −52 por las 10 CPU.

Es lo que dice la regla: a 100cc, quien ya tiene 5000 gana poco por pasar a las CPU normales y pierde mucho si ellas le
ganan (como un jugador de VR alto contra uno de VR bajo en Mario Kart). A 150cc (ancla 5000) los números son los de la
tabla de 95.1.

### 95.6 Pruebas

| Prueba | Resultado |
|---|---|
| banco `vr-sala` | **46/46** (19 nuevos de §95: 400 salas al azar con CPU —el 1.º nunca pierde, el último nunca gana, subir un puesto nunca baja el VR, el orden de la lista no cambia nada, nadie queda peor que su peor caso—; humano pesa más que CPU; los ejemplos ±39/±13; el tope de 2 humanos con 9, 10 y 11 CPU; el peor caso −39 y −65; las fáciles = sin CPU; siempre enteros; puestos que no se pueden creer; el cortado igual pierde; humano sin puesto = cortado; la regla de la foto manda y una rota no; el equilibrio en 6000 carreras: 50 % → 5000, 90 % → ~8200, siempre 1.º → se para en ~11 600) |
| banco `sala-carrera` | 64/64 (sin cambios) |
| banco entero (`node banco/correr.mjs`) | 36 de 36 páginas bien |
| `prueba-sala.mjs` | **35/35** (los puntos del VR cambiados por los de §95: el peor caso con las 10 CPU, cada cambio igual a lo que da `vr-sala.mjs` con los puestos que dio el juego, la regla en la foto de la 2) |
| `prueba-sala.mjs --recarga` | **34/34** (B se va a mitad de la 1: se queda con su peor caso, 4935, y A gana solo lo de las CPU: 5000 → 5012; ver 95.7 por la foto) |
| `prueba-playlist.mjs` | **20/20** (el panel con el VR de §95: B +25, A −1) |

### 95.7 Trampas

- **Una línea del piso en la mitad de la imagen parecía pantalla partida.** En la primera corrida de `--recarga` falló un
  punto viejo: «en la foto de B se ve UNA vista». La foto tenía una sola vista; una línea de las baldosas del piso caía
  justo en la fila del medio y el detector (`foto-pantalla.mjs`, que busca un escalón de luz en la mitad) dio pico 31.
  Ese punto ahora saca **dos fotos** con B acelerando (`dosFotosPartidas`, como ya hacía `prueba-sincro`): la costura de
  una pantalla partida no se mueve, un borde de la pista baja por la imagen cuando el kart avanza.
- **En una página del banco, dos `const` con el mismo nombre la rompen entera.** La página es un solo módulo: el nombre
  repetido (`dos`) no hizo fallar un punto, hizo que la página no corriera («no terminó a tiempo»). Se cambió el nombre.
- **A 100cc los números son chicos para quien gana.** No es un error: con 5000 contra CPU de 3000, ganarle a cada una da
  6 y perder cuesta 26. Es la curva de Mario Kart (ganarle a uno de VR más bajo da poco).

## 2026-10-21 · §96 Los niveles de la CPU: las perillas, una dificultad más alta y el nivel como ajuste de la sala (M20)

**Qué pidió el dueño:**

1. «Identificar todos los parámetros» de la CPU (las «perillas») y **rehacer la dificultad aumentándola**, «donde el más
   difícil sea **todo al máximo**».
2. Después de saber que en el juego la cilindrada y el nivel de la CPU son ajustes separados: «que el nivel de CPU sea
   **un ajuste propio de la sala**, que elige el anfitrión aparte de la cilindrada, con **máximo por omisión**».

### 96.1 Las perillas (decompilar uno mismo)

Los niveles de CPU de Mario Kart Wii **no son código distinto**: son números que el juego lee al empezar cada carrera,
en `AI::Params::Load` (en Retro Rewind, su versión `rr_overlay_8073ACA8`). Dos archivos de `Race/Common.szs` tienen la
mayoría (formatos de mkwiiki), y el resto vive en el código. Un agente leyó el código traducido (solo para entender;
nada copiado) y armó el catálogo. Lo esencial:

**La velocidad** (lo que más pesa). Cada cuadro, para cada CPU:

- **velocidad base** = 70 + `adv` (de `kartAISpdParam.bin`: una fila por cilindrada, pista y nivel) + el bono de
  largada (vale toda la vuelta 1 y se apaga en ~33 s);
- esa base **reemplaza** la velocidad base de su vehículo (después van los mismos turbos que a un humano y el tope del
  juego, 120). Un humano a 150cc tiene 75 a 86 según vehículo y personaje; la CPU difícil del juego, ~75;
- el **elástico**: cada CPU tiene una «casilla» = cuánto se le permite ir detrás de la mejor CPU (`4500 · bias · P`).
  Si va más atrás, gana hasta +10; si va más adelante, se frena hacia su velocidad mínima (`min`). **Se mide contra la
  mejor CPU, no contra el humano**;
- los humanos entran por tres lados: la **ayuda de cola** (si el último humano le lleva mucho a la mejor CPU, todas
  ganan hasta +12), el **arrebato** (una vez por carrera la CPU que va primera persigue al mejor humano: su velocidad
  base + 2 a 12; en difícil pasa el 80 % de las veces, empieza entre los 30 y los 140 s y dura 50 a 70 s) y una
  cancelación en la última vuelta (solo fácil y normal).

**Las maniobras** (`kartAIActionParam.bin`): el porcentaje de cada una por nivel y por puesto (turbo de salida,
derrapar, miniturbo, truco, caballito, cerrar el paso). **Retro Rewind las pone todas al 100 %** (y quemar el motor
al 0 %) en los tres niveles: en nuestro producto ya están al tope.

**Lo que depende del nivel dentro del código** (fácil / normal / difícil): la línea por dentro de las curvas
(−0,3 / 0 / +0,7), cortar por los atajos con champiñón (0 / 50 / 100 %), esquivar el POW (0 / 20 / 40 %), tirar enseguida
el caparazón verde o el plátano (0 / 25 / 60 %), apuntarle a un humano pegado (0 / 20 / 80 %). Con la fila difícil
todo esto ya está en lo más alto que da el juego.

**Los objetos** no dependen del nivel, pero la CPU saca de **su** tabla (la 3 de `ItemSlotRR.bin`), más pobre que la
del humano (la 2): menos objetos fuertes cuando va atrás (la bala solo en el 12.º, nunca tres rojos).

**El «Hard AI» de Retro Rewind** (un ajuste suyo, apagado en nuestra copia) cambia la tabla de velocidad por una con
`adv` 100 y `min` 250: la base queda en 170 y la CPU va **pegada al tope del juego (120)**, un 40 % más rápida que
cualquier kart humano.

**Lo medido el 2026-10-20** con los niveles del juego (40 carreras de 12 CPU, `herramientas/medir-cpu-niveles.mjs`,
mismo kart en las mismas pistas): la normal recorre un 4,3 % menos que la difícil a 150cc (= 72/75: justo la
diferencia de velocidad base) y un 3,2 % menos a 200cc; «espejo» difícil un 7,3 % menos que 150cc difícil (ayer
no tenía explicación: en §96.6 se ve que ese «espejo» corría en realidad 100cc).

### 96.2 Los cuatro niveles de la página

| Nivel | Fila del juego | Encima | Velocidad base a 150cc |
|---|---|---|---|
| Fácil | su normal | nada (lo que antes era «normal») | ~72 |
| Normal | su difícil | nada (lo que antes era «difícil») | ~75 |
| Difícil | su difícil | cada perilla a mitad de camino hacia máximo; el arrebato siempre | ~80 |
| **Máximo** | su difícil | **todo al tope** (abajo) | **~86** |

«Todo al tope» en máximo:

- **velocidad base ×1,14**: a 150cc, de ~75 a ~86, la del kart más rápido que puede armar un humano;
- **sin frenarse a propósito**: `bias` 0 (ninguna CPU tiene «casilla» de atraso: todas las que van detrás de la mejor
  recuperan) y la mínima = la base;
- **el arrebato siempre**, desde los 10 s y durante toda la carrera (600 s);
- **la tinta del Blooper no la frena** (el juego: ×0,8);
- **los objetos de la tabla del humano**;
- y todo lo que depende del nivel dentro del código, en lo más alto (la fila difícil).

Por qué **no** el «Hard AI» de Retro Rewind: con la base en 170 la CPU va siempre a 120, un 40 % más rápida que
cualquier kart humano: no se le puede ganar, y el VR contra ella dejaría de medir nada. El tope que se eligió es el de
un humano perfecto con el mejor kart, más los mecanismos del propio juego (el elástico y el arrebato) siempre a favor
de la CPU.

### 96.3 Cómo se hizo

- **La página** (`web/navegador/dificultad-cpu.mjs`): el perfil de cada nivel (`perfilCpu`) y `aplicarPerfilCpu`, que
  se lo pasa al código nativo **antes de abrir cada carrera** (`directo.mjs`, `escribirFicha`). La ficha lleva el nivel
  como número (0 fácil … 3 máximo).
- **`directo_nativo.cpp`**: al juego va la fila un nivel más arriba (`kFilaDelJuego = {1, 2, 2, 2}`).
- **`web/juego/cpu_dificultad_nativo.cpp`** (nuevo), dos envolturas:
  - `rr_overlay_8073ACA8` (la carga de las perillas): primero carga el juego lo suyo; después se escribe encima la
    velocidad (la única estructura `{adv, bias, min}` que comparten las 12 CPU), la tabla del arrebato (0x808CB388) y la
    tinta (0x808A2B44). Las constantes del juego se guardan la primera vez y **se reponen al empezar cada carrera**: una
    carrera «normal» después de una «máximo» vuelve a ser la del juego. Cada escritura tiene su **guardia**: solo si ahí
    está el valor que se leyó en el código (si no, se salta y `mkw_cpu_estado(7)` lo dice);
  - `rr_overlay_807BB42C` (el reparto de objetos): con «objetos del humano», cuando saca una CPU, por esa llamada su
    tabla es la del humano y después vuelve a la suya.
  Todo pasa al armar la carrera, en el mismo momento en todas las consolas: la sala sigue sincronizada.
- `mkw_cpu_estado(k)`: lo que hizo el gancho (para las pruebas y la medición).
- `herramientas/compilar-web.py`: las dos funciones en `REEMPLAZOS` y el archivo nuevo en las unidades.

### 96.4 El nivel como ajuste de la sala

En las carreras VS del juego la cilindrada (ajustes +0x4) y el nivel de la CPU (+0x14) son dos casillas distintas;
solo el Grand Prix saca el nivel de la cilindrada (lo confirma `SetCCAndDifficulty`, 0x8073999C). La página copiaba la
regla del Grand Prix (`cpuDe`); ahora:

- **el sitio** (`motor.js`): `MKW_NIVEL = {maximo, dificil, normal, facil}` y la jugada `{t:"ajuste", k:"nivel", v}`
  (solo el anfitrión, solo en el vestíbulo; lo que no existe = máximo); **el vestíbulo** (`mkw.js`) tiene la fila «CPU»
  al lado de la cilindrada y el encabezado dice el nivel; **la dirección del marco** lleva `&cpu=`;
- **la página del juego** (`mkw.mjs`): `cpuDe = () => parametros.get('cpu') || 'maximo'`, sin mirar la cilindrada.

### 96.5 Lo medido con los niveles nuevos

`node herramientas/medir-cpu-niveles.mjs --etiqueta m20 --combos c150:facil,c150:normal,c150:dificil,c150:maximo,espejo:maximo,c100:maximo`
(48 carreras de 12 CPU, sin humano, 4 pistas × 2 semillas, el mismo kart en el mismo puesto en cada combinación →
`build/web/datos/cpu-niveles-m20/`). En todas el gancho dijo que actuó (las guardias, «ok»; a 150cc máximo escribió
`adv` 15,5 —base 85,5—, `bias` 0 y `min` 85,5):

| Comparación (el mismo kart, en la misma pista) | Recorre |
|---|---|
| Fácil contra Normal | **−6,0 %** (más lento el mismo kart en 88 de 96) |
| Difícil contra Normal | **+8,4 %** (más rápido en 92 de 96) |
| Máximo contra Normal | **+14,0 %** (más rápido en 95 de 96) |
| Máximo contra Difícil | +5,6 % |
| Espejo máximo contra 150cc máximo | −2,0 % (dentro del ruido: abajo) |
| 200cc máximo contra 150cc máximo | +15,5 % (la cilindrada) |

**El ruido entre corridas.** Sin la sala, el azar de cada carrera sale del reloj de la PC: dos carreras con la misma
semilla no son iguales cuadro a cuadro (la semilla fija la pista, los personajes y los vehículos). Para medirlo, un
control: el «normal» nuevo es la misma fila del juego, sin cambios, que el «difícil» de la medición de ayer. Dio +2,0 %
de media (las 8 pistas y semillas, de −1,1 % a +4,8 %). O sea: diferencias de 2-3 % entre dos corridas son ruido; las
de los niveles (+8 % y +14 %) no.

### 96.6 El «Espejo» de la sala no era espejo (arreglado)

El registro del gancho mostró que en las carreras «espejo» el juego cargaba la fila de **100cc**. Leyendo la memoria en
una carrera directa: la ficha pedía 150cc con la marca de espejo y la carrera quedaba **en 100cc y sin la marca**. La
causa está en Pulsar (`Racedata_InitRace`, `rr_kamek_81855954`, que envuelve a `Racedata::InitRace`): **fuera de línea,
Retro Rewind usa el botón «espejo» del menú del juego como su «100cc»** (borra el espejo de la carrera y pone 100cc;
`Is200cc` lo distingue del 200cc). El espejo de Retro Rewind existe solo en las salas de amigos en línea, como ajuste.
Así que **el «Espejo» de nuestra sala corría 100cc, sin dar vuelta la pista**: por eso esas carreras eran un 7 % más
lentas (§96.1).

Arreglo (`directo_nativo.cpp`): la ficha ya no pone la marca de espejo en los menús, y se envuelve
`rr_kamek_81855954`: después de Pulsar, si la ficha pidió espejo, la marca va en la carrera (ajustes +0x28, bit 0).
Comprobado: la carrera queda en 150cc con la marca, la IA carga la fila de 150cc, la foto sale dada vuelta (el bloque
«?» a la derecha, el minimapa reflejado) y el espejo-máximo corre como el 150cc-máximo (−2 %, ruido).

### 96.7 El VR de cada nivel

La regla de §95 sigue igual (cada CPU, un rival de VR fijo; 1/4 de un humano; todas juntas a lo más 2 humanos); cambian
las anclas, ahora una por nivel de la página: **fácil 3000, normal 5000, difícil 7400, máximo 9400**
(`REGLA_CPU.anclas`, 4 valores; la regla de 3 de §95, si llegara en una foto vieja, se cambia por la de la página).

- La escala no cambió: **5000 = le gana la mitad de las veces a la «normal»** (la «difícil» del juego, la de §95).
- Las otras salen de lo medido: si una CPU va un d % más rápida, una persona de 5000 le gana con probabilidad
  Φ(−d/σ) (σ = cuánto varía una persona de carrera a carrera, en % de la distancia), y el VR de esa CPU es el de la
  persona que le gana la mitad de las veces (el equilibrio de la regla, con la curva del juego). Con σ = 5 / 6,5 / 8 %:
  fácil 2800 / 3300 / 3600, difícil 9100 / 8200 / 7400, máximo 11 700 / 10 700 / 9400.
- Se eligió **σ = 8 %**, el supuesto que da las anclas **más bajas** para las CPU fuertes (el crítico de §95: un ancla
  alta se aprovecha, una baja solo cuesta un poco de VR); fácil se dejó en 3000 (la de §95).
- Ejemplo, 2 humanos de 5000 y 10 CPU: salir 1.º da +25 contra fáciles, +39 contra normales, +71 contra difíciles y
  **+109 contra máximo**; salir 12.º cuesta −65, −39, −23 y **−17**. Contra CPU más fuertes ganar premia más y perder
  castiga menos, como en Mario Kart contra alguien de VR muy alto.

### 96.8 Pruebas

| Prueba | Resultado |
|---|---|
| banco `dificultad-cpu` (nuevo) | **21/21** (los 4 niveles y cómo se piden; cada nivel igual o más fuerte que el anterior en todas las perillas; máximo todo al tope y difícil la mitad del camino; lo que llega al código nativo con un Module de mentira; la ficha manda el número; la página, `directo_nativo.cpp` y `cpu_dificultad_nativo.cpp` dicen lo mismo —las filas, la tabla del arrebato y la tinta que el gancho espera—; en la sala el nivel no sale de la cilindrada) |
| banco `vr-sala` | **47/47** (las 4 anclas; con CPU más fuertes ganar da más y perder cuesta menos; la regla de 3 niveles de §95 se cambia por la de la página; los ejemplos y el equilibrio, con la CPU normal de 5000) |
| banco entero (`node banco/correr.mjs`) | 37 de 37 páginas bien |
| sitio `colabtex/tests/mkw.test.cjs` | **19/19** (el nivel es del anfitrión, aparte de la cilindrada, máximo por omisión, no cambia con la copa andando, va al marco como `&cpu=`) |
| `prueba-directa.mjs` | 13/13 («normal» de la página llega al juego como su fila 2) |
| `prueba-sincro.mjs --directa --cpu=maximo` | **13/13**: las huellas de la carrera coinciden en las dos pestañas con todo el gancho andando (velocidad, arrebato, tinta, objetos del humano) |
| `prueba-sala.mjs --cpu=maximo` | **35/35** (la copa entera de 2 en máximo; el VR con el nivel 3 y la regla de 4 anclas en la foto) |
| `prueba-playlist.mjs` | 20/20 |
| `herramientas/prueba-experiencia.mjs --rapida` (el sitio local con emuladores) | **12/12**: el vestíbulo con la fila «CPU» (Máximo marcado) y «CPU máximo» en el encabezado. Fallaban 2 puntos de antes: esperaban «2 de 4» y la sala nace con 12 desde §91 (C9); corregidos |
| la medición (§96.5) | 48 carreras de 12 CPU + 8 de espejo de verdad |

El programa para publicar (`compilar-web.py --modo navegador --final` y subirlo a R2) lo rearma y sube el dueño
(`docs/publicar.md`). Hasta entonces el sitio de verdad corre la página nueva con el `.wasm` viejo, y no se rompe: sin
`_mkw_cpu_perfil`, `aplicarPerfilCpu` no hace nada y la ficha manda a lo más el nivel 2 (`escribirFicha`: «máximo»
sería una fila que el juego no tiene); el programa viejo escribe ese número tal cual, así que ahí «normal» es la fila
normal del juego y «difícil» y «máximo», su difícil. El espejo de verdad también necesita el programa nuevo.

### 96.9 Trampas

- **Revisar lo que trae un informe.** El agente arrancó con cuatro funciones que leían la tabla de velocidad: eran las de
  las misiones, la batalla y los premios. La del VS era una quinta. Y el catálogo decía que espejo usa la fila de 150cc;
  la memoria del juego corriendo mostró que no (§96.6). Lo que se dé por cierto, medirlo.
- **Sin la sala, dos carreras con la misma semilla no son iguales.** La semilla fija la pista, los personajes y los
  vehículos, pero el azar de la carrera sale del reloj de la PC (solo la sala lo fija). Las comparaciones son por
  promedio de 8 carreras, con un control para saber cuánto es ruido (§96.5).
- **Las pruebas piden `cpu=normal`; la sala, máximo.** Para probar lo que de verdad usa la sala se agregó `--cpu=` a
  `prueba-sala.mjs` y `prueba-sincro.mjs`.
- **El registro de la compilación dice `build\web\node`** aunque compile para el navegador (comparten los archivos
  intermedios): lo que importa es que `build/web/navegador/mkw.wasm` tenga la hora nueva.

## 2026-10-21 · §97 El vestíbulo nuevo de la sala (la propuesta D) y el orden de las opciones (M21)

**Qué pidió el dueño:**

1. «Los órdenes de ambos no concuerdan»: la cilindrada y la CPU, **siempre de menos a más**.
2. «Un rework de la UI multiplayer porque está feo, pero propón primero 3 alternativas con el crítico». Después de
   verlas: «Programa la propuesta D, la mezcla del crítico».

### 97.1 El orden (de menos a más)

En el sitio (`motor.js`) el orden de los botones es el de las claves de `MKW_CC` y `MKW_NIVEL`:

- **Cilindrada:** 150cc · Espejo · 200cc · Al azar. Espejo va después de 150cc: misma velocidad, pistas dadas vuelta.
  Al azar va al final porque mezcla, no es «más».
- **CPU:** Fácil · Normal · Difícil · Máximo (antes iba de Máximo a Fácil).

Commit propio en el sitio (`2a06fc6`); las pruebas del sitio piden ese orden.

### 97.2 Tres propuestas, un crítico y la mezcla

Qué tenía de feo la sala: todo pesaba lo mismo (título, opciones, botón); la sala es de 12, pero se veían 2 tarjetas
sueltas y no se veía que la CPU completa el resto; el invitado veía los botones del anfitrión apagados (parecían
rotos); «¡A correr!» quedaba abajo a la izquierda.

Se hicieron tres maquetas que se pueden tocar (anfitrión e invitado), en una página publicada para el dueño:

- **A · La parrilla de 12:** los 12 lugares como el vestíbulo en línea de Mario Kart, la CPU en los vacíos.
- **B · El tablero en dos columnas:** las opciones con su explicación a la izquierda, los pilotos y el botón a la
  derecha.
- **C · La ficha de carrera:** lo que se corre en grande, las opciones detrás de «Cambiar», los pilotos en fichas.

Un **crítico aparte** (otro agente, sin esta conversación) abrió las maquetas, las **midió** con 2 y con 12 pilotos y
con el panel a 916, 684 y 404 px, y leyó el código de la sala. Su orden: **C, B, A**, y **ninguna tal cual**:

- A: 10 tarjetas fantasma «CPU» en una sala normal de 2 a 4 amigos; números de puesto que no son la parrilla; el
  invitado sigue viendo botones apagados; no se pliega en la tira de la carrera.
- B: con 12 pilotos el panel mide 880 px y «¡A correr!» queda donde hay que bajar la página; parece un formulario.
- C: la jerarquía más clara y la mejor para el invitado, pero con 12 pilotos las fichas se apilan en filas desparejas.

Recomendó una **mezcla**, que se maquetó como **propuesta D** y es la que eligió el dueño: la ficha de C arriba con
«¡A correr!» adentro; las opciones de C detrás de «Cambiar», con la ayuda de B; la lista de B en dos columnas con un
«⋯» por piloto; y la idea de A en una línea («3 de 12» con 12 puntitos y una sola fila para la CPU).

### 97.3 Cómo quedó (sitio: `colabtex/src/juegos/mkw.js`)

De arriba abajo:

- **La ficha de carrera:** «Mario Kart Wii · lo que se corre», el titular «Copa · 150cc · CPU máximo» con la letra de
  la portada de Mario Kart (gruesa, cursiva, sombra roja), una línea que explica el modo, y a la derecha
  **«¡A correr!» grande** (anfitrión) o «● Esperando a que X abra las carreras» (invitado, con un puntito que late).
  Arriba, un borde a cuadros de bandera de llegada.
- **«✎ Cambiar»** (solo el anfitrión, antes de empezar): abre modo, cilindrada (con «Al azar» separado) y CPU, cada
  una con la ayuda del valor elegido; «Cerrar» la guarda.
- **Los avisos** de siempre (sin el programa publicado, mirando, echado, «la copa empezó sin ti»).
- **La última copa:** los tres primeros y «Ver tabla» (las 12 filas, en dos columnas si el panel es ancho).
- **Los pilotos:** «N de 12» con 12 puntitos; una fila por piloto con **su foto del sitio** (`ctx.avatar`, la misma
  que en el encabezado de la sala), el nombre (`translate="no"`), la **corona** del anfitrión, «tú», el **VR a la
  derecha** (también el del anfitrión) y, para el anfitrión, el **«⋯»** con «Pasar anfitrión» y «Echar de la sala»;
  después una sola fila punteada «+ 9 CPU · Máximo» (no aparece con 12 humanos). Dos columnas si el panel mide
  640 px o más.
- **Con la copa andando**, la tira: el titular en chico, las fichas de los pilotos (con el «⋯» para echar) y «Volver al
  vestíbulo» para el anfitrión.

Cómo está hecho:

- **Los estilos los trae el módulo** (`ponEstiloVest`: un `<style id="jg-mkw2-estilo">` una sola vez), todos debajo de
  `.jg-mkw-vest.jg-mkw2`, que pesa más que las reglas viejas `.jg-mkw-*` de `juegos.html` (ese archivo no se toca;
  del viejo quedan el fondo azul, el borde y el color de letra). Los cambios de ancho usan `@container` (el ancho del
  panel). El dorado significa solo «elegido»; el anfitrión lleva corona.
- **Un solo manejador de clics** para todo el panel (`clicVest`), Escape cierra el «⋯» o «Cambiar», y un clic fuera
  cierra el menú. Las jugadas son las de siempre (`ajuste`, `anfitrion`, `echa`, `empieza`, `vuelve`).
- **Lo abierto va en la firma** (`abierto = {cambiar, menu, tabla}`) y el foco vuelve al mismo botón (`data-foco`):
  si alguien entra mientras el anfitrión elige, el panel no se cierra solo.
- Se conservan como enganches las clases que usan las pruebas: `jg-mkw-empieza`, `jg-mkw-modo`, `jg-mkw-dar`,
  `jg-mkw-echa`, `jg-mkw-vuelve`, `data-cc`, `data-nivel`.

### 97.4 Pruebas

| Prueba | Resultado |
|---|---|
| sitio `colabtex/tests/mkw.test.cjs` | **19/19** (el orden de menos a más; «Echar» en el «⋯» del anfitrión, también en la tira de la carrera) |
| `herramientas/prueba-experiencia.mjs` (la sala de verdad con emuladores, dos cuentas, carrera y echar con la carrera andando) | **20/20** |
| `herramientas/prueba-experiencia.mjs --playlist` | **22/22** (la anfitriona abre «✎ Cambiar», elige Playlist, y Piloto Dos lo ve en el titular) |

Fotos en `build/web/datos/experiencia/`: `6-vestibulo-dos.png` (el invitado) y `9-tira-uno.png` (la tira de la
anfitriona con la copa andando).

### 97.5 Trampas

- **La tira de la carrera también tiene que decir cuántos son.** La primera versión de la tira no mostraba «N de 12» y
  el ensayo (echar con la carrera andando: la sala de la anfitriona tiene que quedar «1 de 12») falló 19/20. La sala
  vieja lo decía en su encabezado; la tira nueva lo dice al lado del titular.
- **Los estilos no van en `juegos.html`** (regla del proyecto; la guía del sitio dice lo contrario para los demás
  juegos): van en el módulo, y con una clase extra (`jg-mkw2`) para ganarles a las reglas viejas `.jg-mkw-*` que
  siguen en `juegos.html` (por ejemplo, las tarjetas de modo con borde dorado).
- **El ícono de la corona tiene un título** («Anfitrión»): aparece en el texto del panel que leen las pruebas. Es a
  propósito (lo lee quien usa un lector de pantalla).

## 2026-10-21 · §98 El «Modo consola»: antes, durante y entre carreras (M22)

**Qué pidió el dueño:**

1. «Lanza un crítico, haciéndole ver cómo es la experiencia de usuario antes, después y entre carreras, para que
   proponga 3 modelos de mejora».
2. Después de leerlos: «Haz el modelo recomendado, pero agrega eso de una opción de poder volver a elegir combinación
   de karts, pero que sea opcional».

### 98.1 El crítico y el modelo elegido

Un crítico aparte (otro agente, sin esta conversación) recorrió la sala entera con las fotos de las pruebas y el
código: el vestíbulo, la espera de la copa, la elección, la carrera, el descanso y el final. Lo que encontró (en
corto): **el panel del descanso tapaba la tabla del juego** (los puntos del 4.º al 9.º) y además repetía lo que la
tabla ya dice; **los nombres no cuadraban** (en la tabla del juego uno se llamaba «Piloto» y el otro no tenía nombre);
el **invitado esperaba a ciegas** mientras el anfitrión elegía la copa (sin reloj, y el aviso parecía decir «espera»
aunque ya se podía elegir personaje); los **avisos de red tapaban la carrera** al centro; el **final era una píldora**
que tapaba la fila del 1.º; quien **recargaba** veía una pantalla de personajes sin saber qué pasaba; la **tira del
sitio mentía** toda la copa («Arma la lista…» con la carrera andando); un clic en «Volver al vestíbulo» cerraba la copa
de todos sin preguntar; y varios textos hablaban de celulares (fuera del lanzamiento).

Propuso tres modelos y recomendó el **1, «Modo consola»**: la página deja de hablar encima del juego y habla en las
pausas, con la letra y los colores del juego (como una consola, donde todo lo dice el mismo aparato), más dos piezas
del modelo 2 (el estado de cada piloto en el vestíbulo y una vista mínima para quien llega tarde) y una del 3 (el ±VR
escrito en la tabla del juego). El dueño lo eligió y agregó **volver a elegir personaje y vehículo entre carreras, si
uno quiere**.

### 98.2 Los arreglos rápidos

- **El reloj de la copa:** el anfitrión tiene 90 s para elegir la copa (`SEGUNDOS_COPA` de `sala-carrera.mjs`, lo ven
  todos: «Elige la copa: 52 s (si no, sale una al azar)»); al vencer, su página pone una copa al azar (`alVencioCopa`).
  En la playlist no hay reloj (se arma con sugerencias). `?copaReloj=N` s solo para pruebas.
- **El invitado ya puede elegir** mientras el anfitrión elige la copa, y el aviso lo dice: «Ya puedes elegir personaje
  y vehículo · Ana está eligiendo la copa (52 s)…». En la elección, a quién se espera por su nombre («faltan Beto»).
- **La tira del sitio dice la verdad:** el marco le avisa al sitio en qué fase está la sala (`{tipo:'fase'}`: copa,
  elegir, carrera N de M, descanso, fin) y la tira lo escribe.
- **«Terminar la copa para todos»** (antes «Volver al vestíbulo») pregunta antes de cerrar la copa de todos.
- **Al echado**, «← Volver a Juegos»; el VR de quien nunca corrió dice «5000 nuevo» (antes «—»).
- **Solo PC:** los controles del sitio y las reglas ya no ofrecen táctil ni Android (celulares fuera del lanzamiento);
  las reglas explican el DNF de 30 s y el límite de 5 min (antes «el juego saca a quien se queda quieto», que ya no es
  así) y que la CPU cuenta para el VR.
- **Los avisos de red con nombre y cortos** («📶 Beto va lento»), y el aviso de récord VS ya no sale en la sala.
- **La semilla** del selector de copa solo con `?depurar=1`, y la imagen que falta es una ficha de color (antes una
  caja vacía que parecía rota).

### 98.3 El descanso: un zócalo, el ±VR en la tabla del juego y volver a elegir

**El zócalo** (`interfaz.mjs` `playlistBreve`, estilos en `index.html`): el panel de la derecha pasó a una franja de
una línea abajo (como el zócalo de la tele). Muestra la copa y cuántas van, la cuenta («La carrera siguiente en 24 s»),
**tu** puesto, puntos y VR, la pista que sigue (las demás: «y 5 más») y los botones. Con la ventana más alta que 16:9
queda en la banda negra; en 16:9 tapa solo el borde de la fila 12. Los resultados de todos siguen en el panel como
lista para el lector de pantalla (`.pb-res`, que no se ve).

**El ±VR en la tabla del juego** (`web/navegador/letreros.mjs`): 3 s después de que aparece la tabla de puntos del juego
(página 0x30; antes el juego la anima: suma y reordena), la página escribe «+39 VR» (verde) o «-13 VR» (rojo) **al lado
de la fila de cada humano**, con la letra del juego (la misma fuente que el contador DNF, `cargarFuentes` + `pintar`; si
falta una letra, la de reserva). Cómo sabe la página en qué fila está cada uno:

- las filas están a alturas fijas de la imagen 16:9, medidas en una foto del descanso: la fila *k* en
  44 + 40,45·(*k* − 1) de 540 px, y la tabla termina en 822 de 960 px (de ahí a la derecha queda una franja libre);
- el orden de la tabla sale de la sala (iguales en todas las consolas): más puntos de la copa arriba y, a igual
  puntos, el que llegó antes en esta carrera (`filasDeTabla`). En la prueba: B ganó (15 pts, fila 1, «+39 VR») y A
  llegó 2.º (12 pts, fila 2, «+13 VR»).

**Volver a elegir (opcional):** el zócalo tiene «Cambiar personaje y vehículo» (no en la última carrera). Abre la
pantalla de personajes del juego por código (`directo.elegir`, como al empezar la copa); el zócalo se achica a «Elige
personaje y vehículo en el juego. Si no alcanzas, corres con el de antes.». Lo elegido va a la anfitriona
(`sala.elegi`), que lo acepta en el descanso (antes solo en la fase de elegir) y la ficha de la carrera siguiente lo
lleva en todas las consolas. Mientras se elige, el cerrojo de los botones (§94) deja pasar todo.

### 98.4 La trampa de volver a elegir: el «modo elección» se apagaba solo

La primera prueba de volver a elegir falló: la pantalla de personajes se abría, pero lo elegido nunca llegaba. Un
experimento en dos pestañas (`depurar-reelegir.mjs`, en el borrador) mostró que el teclado sí llegaba (la pantalla
pasaba de personaje a vehículo y a derrape), pero **al confirmar el derrape el juego seguía de largo**: elegía pista
(0x4B) y abría **otra carrera fuera de la sala** (0x1A). La causa, en `directo_nativo.cpp`: el «modo elección» (que
hace que al confirmar el derrape el juego se quede quieto y avise a la página) se apaga con cualquier salto que pide la
página; al empezar la copa el salto a la pantalla de personajes va por otro camino (la envoltura de
`SectionMgr::Init`) y no lo apagaba, pero en el descanso el salto va por el camino normal y lo apagaba antes de
elegir. Arreglo: el salto a la pantalla de personajes (sección 0x49) ya no lo apaga; el de la carrera, sí.

### 98.5 Los nombres de verdad en el juego

Un agente siguió en el código traducido de dónde saca el juego el nombre del globo sobre cada kart y de las filas de
las tablas (informe completo en el borrador, `nombres-juego.md`):

- el globo (`UpdateInfo`, `rr_overlay_807F0044`) y las tablas (`FillName`, `rr_overlay_807F52F4`) escriben, para los
  humanos, el nombre del **Mii de esa casilla de SectionParams +0x188** (un MiiGroup de 12 lugares, uno por puesto de
  la carrera), con el mensaje 9501 (el nombre del Mii, Mii +0x68); si el Mii tiene la marca +0xA5 escribe «Player»;
  a las CPU les escribe el nombre del personaje (con las skins de Retro Rewind);
- el juego llena ese grupo **como si los jugadores de esta consola fueran los puestos 0, 1…**: la elección de personaje
  copia la licencia en la casilla 0 («Piloto») y las demás quedan vacías. En la sala B corre en el puesto 1: la casilla
  0 (que es A) decía «Piloto» y la 1, nada.

La solución (`web/juego/nombres_nativo.cpp` + `web/navegador/nombres-juego.mjs`):

1. **Un Mii en cada casilla de humano.** Envolviendo `CharacterSelect::OnInit` de RR (`rr_overlay_8083D55C`): es el
   momento en que el juego mismo carga Mii en ese grupo, con el dibujante de caras listo. A cada casilla de humano vacía
   le carga un Mii invitado (`MiiGroup::LoadDefaultMii`, 0x805FA748) con una cara fija para ese uid (`caraDe`).
2. **El nombre, en cada carrera.** Al final de `Racedata_InitRace` de Pulsar (la envoltura de §96 en
   `directo_nativo.cpp`), el nombre que manda la sala se escribe en el Mii de la casilla de cada humano (hasta 10
   letras UTF-16) y se baja la marca +0xA5. Solo escrituras: ahí todavía no se puede reservar memoria (el dibujante de
   la carrera no existe).
3. **Cómo nombra el juego a cada CPU.** Ya en la carrera (al empezar `SectionMgr::Update`), con las mismas funciones
   que usa el juego (`GetCharacterNameBMGId` y `GetCustomMsg` de Pulsar, `rr_kamek_8185285C` y `rr_kamek_818611E0`):
   el texto con la skin de RR y en el idioma del juego («Meowser», «King Bob-omb», «Toadette (Summer)»). La página lo
   usa en la tabla del final y en el podio (antes salía «Bowser (CPU)» donde el juego decía «Meowser»).

Nada de esto cambia la carrera: solo la interfaz lee esos Mii (la huella del lockstep compara karts y botones), y se
escribe lo mismo en todas las consolas. La página limpia el nombre a lo que la letra del juego puede escribir
(`nombreParaJuego`: 10 letras, sin emoji ni caracteres de control; vacío = «Piloto»). `?nombresJuego=0` = como antes.

4. **Las mismas CPU para quien recargó.** Retro Rewind sortea las skins de las CPU solo en la primera carrera de cada
   consola (con el reloj de la carrera: igual en todas las que la corrieron). Quien recarga a mitad de la copa no sortea
   y veía otras CPU, con otros nombres (la prueba `--recarga` lo encontró: la tabla del final no era igual en las dos).
   Y no solo quien recarga: **volver a elegir también las borra** (pasar por la pantalla de personajes las pone en 0 y
   RR no vuelve a sortear), así que después de volver a elegir A veía «Bowser» donde B veía «Meowser». Ahora cada
   consola manda con su aviso de fin de la carrera 1 las 12 skins que sorteó (`racePlayerSlots`, 0x818A08A8; las copia
   el C++ al armar la carrera, porque el lector de memoria de la página solo llega hasta 0x81800000); la anfitriona
   guarda las de una que corrió desde la 1 (`estado.skins`, una vez) y antes de cada carrera todas las escriben al final
   de `Racedata_InitRace`, después del sorteo de RR, solo en los puestos de CPU y solo si esa skin existe para ese
   personaje (`characterTables`, 0x81878C7C).

Lo que queda (solo de pantalla): en la consola de B la casilla de A lleva la cara de la licencia de B (el juego la
copia ahí al elegir). La carrera es la misma.

### 98.6 El final, quien recargó y los avisos por capas

- **El podio** (`letreros.mjs` `podio`): al terminar la copa, 8 s con «¡GANÓ JUGADOR 1!» y los tres primeros de la
  tabla (los humanos con el VR que ganaron o perdieron en la copa) y, si no estás entre los tres, tu fila; con la letra
  del juego sobre la imagen. Recién después el marco le avisa al sitio (`{tipo:'fin'}`) y vuelven al vestíbulo.
  `?podio=N` ms (0 = sin podio).
- **Quien recargó** con la copa andando ve un **cartel arriba**: «Carrera 1 de 2 en curso · Vuelves en la 2. Mientras,
  si quieres, elige personaje y vehículo». Lo que elige ahí llega a la anfitriona en el descanso (el primer momento en
  que lo acepta) y corre desde la siguiente.
- **Los avisos por capas:** al centro solo lo de la carrera (esperar a alguien, un corte, salirse); el estado (📶
  alguien va lento, la PC lenta) pasó a un chip en la **esquina de arriba a la izquierda** (donde el juego no pone HUD),
  6 s cada vez que cambia y solo con la carrera andando (ver la trampa de §98.9); el VR ya no va en la píldora del
  centro (está en la tabla y en el zócalo).

### 98.7 Antes de la carrera: modo inmersivo y la precarga con el estado de cada piloto

- **Modo inmersivo al empezar, opcional** (sitio, `colabtex/src/juegos/mkw.js`): con «Pantalla completa al empezar»
  prendido en el vestíbulo (de cada uno, en su navegador; **apagado por omisión**, §98.10), al empezar la copa la sala
  pasa sola al modo inmersivo del sitio (sin cabecera, el chat flotante encima; el sitio le presta `ponInmersivo` al
  módulo) y el marco llena la pantalla; al volver al vestíbulo sale. Una vez por copa: si sale con Esc, no se le vuelve
  a poner.
- **La precarga del vestíbulo:** mientras se conversa, un marco escondido abre la página del juego con `?precarga=1`
  (`precargarTodo` en `mkw.mjs`): baja el manifiesto, los archivos chicos, el paquete de diminutos, el programa (con su
  huella, a la caché HTTP) y la semilla de bloques (la del arranque y hasta 32 MB de lo de después del título, a Cache
  Storage), **sin arrancar el juego** (sin WebGPU ni la memoria del wasm). Avisa cuánto lleva.
- **El estado de cada piloto:** el sitio escribe ese porcentaje en la presencia del buzón de la sala (`~40`, `~listo`;
  la malla del juego no toma lo que empieza con «~» por una sesión, `malla.mjs`) y cada fila del vestíbulo muestra
  «⬇ 40 %» o «● listo». No hace falta ninguna regla nueva de Firebase: es la misma presencia que ya usa la malla.

Medido con `node web/navegador/prueba-precarga.mjs` (dos perfiles de Chrome nuevos, 50 ms de red como R2):

| | Sin precarga | Con precarga |
|---|---|---|
| Hasta la carrera (abrir la página → carrera directa) | 10,5 s | **8,4 s** |
| Del programa por la red | 16,9 MB | **0** (de la caché HTTP) |
| Del disco por la red | 60,7 MB | **19,7 MB** |
| La precarga misma | — | 2,4 s (en esta PC; en internet, lo que tarden ~80 MB mientras se conversa) |

En esta PC la red es instantánea; en internet la diferencia es lo que tardan ~60 MB (a 50 Mbit/s, unos 10 s menos).

**Hasta que el dueño suba el programa nuevo** (`compilar-web.py --modo navegador --final` y `subir-r2.mjs`,
`docs/publicar.md`), el sitio corre esta página con el `.wasm` de antes y no se rompe: sin `_mkw_nombres` la página no
escribe nombres ni lee los de las CPU (quedan los de su tabla), no reparte skins y **no ofrece «Cambiar personaje y
vehículo»** (con el programa de antes, el salto a la pantalla de personajes apagaba el modo elección y el juego se iba
solo a otra carrera). El zócalo, las marcas, el podio, el cartel, la precarga y lo del sitio andan igual.

### 98.8 Pruebas

| Prueba | Resultado |
|---|---|
| banco `letreros` (nuevo) | **17/17** (la fila de cada puesto con empates, las alturas medidas, cada marca en su fila y en la franja libre también con bandas, verde/rojo, la letra de reserva, el podio y el cartel) |
| banco `nombres-juego` (nuevo) | **15/15** (10 letras, tildes sí, emoji no, NFC, la cara fija, el búfer como lo lee el C++, el texto de las CPU, las skins) |
| banco `sala-carrera` | **75/75** (11 nuevos: el reloj de la copa visto por todos, al vencer solo avisa a la anfitriona una vez, la playlist sin reloj; volver a elegir no a mitad de carrera, sí en el descanso y la carrera siguiente lo lleva igual en todas; las skins: solo de quien corrió desde la 1, una vez, nunca rotas) |
| banco `sala-playlist` / `playlist-sala` / `red` / `cuenta-dnf` | 37/37 · 25/25 · 28/28 · 25/25 |
| `prueba-sala.mjs` | **42/42** (7 nuevos: los nombres en el juego en las dos, el nombre de cada CPU igual en las dos, el ±VR en su fila, A vuelve a elegir y la carrera 2 lo lleva en las dos, el podio y que se va) |
| `prueba-sala.mjs --rapida --cpu=maximo` | **40/40** en 145 s (sin los dos puntos que miden 30 s; antes ~6 min) |
| `prueba-sala.mjs --recarga --rapida` | **38/38** en 165 s (B recargó: su consola no sortea skins, pero con las de la sala ve las mismas CPU) |
| `prueba-elegir.mjs` / `prueba-playlist.mjs` | **69/69** · **20/20** |
| `prueba-sala.mjs --recarga` (y `--rapida`) | **38/38** |
| `prueba-relevo.mjs` | **10/10** (con el chip de 6 s; con el chip puesto toda la carrera fallaba, ver §98.9) |
| `prueba-precarga.mjs` (nueva) | **8/8** |
| sitio `colabtex/tests/mkw.test.cjs` (+ Worker) | **20/20** (+ 6/6; nuevo: inmersivo, precarga y presencia, la tira con la fase, solo PC, el echado sin caja de invitar) |
| `herramientas/prueba-experiencia.mjs` | **22/22** (2 nuevos: «● listo» de los dos en el vestíbulo y el modo inmersivo al empezar en los dos; el echado pierde también el inmersivo) |
| `herramientas/prueba-experiencia.mjs --playlist` | **24/24** |

Fotos en `build/web/datos/sala/`: `4-B-marcas.png` (la tabla del juego con los nombres, el ±VR al lado de cada humano
y el zócalo), `4-A-reelegir.png` (volver a elegir), `6-A-fin.png` (el podio); en `build/web/datos/experiencia/`:
`6-precarga-uno.png` (el vestíbulo con «● listo») y `9-inmersivo-uno.png` (el juego a pantalla del sitio, con el nombre
«Piloto Dos» sobre su kart).

### 98.9 Trampas

- **El `.wasm` sin comprimir no entra en la caché HTTP.** La primera corrida de la precarga dio «el programa viaja de
  nuevo»: el `mkw.wasm.br` era más viejo que el programa recién compilado, el servidor mandó los 130 MB sin comprimir y
  Chrome no guarda en su caché una entrada tan grande. Comprimido (`node herramientas/comprimir-build.mjs`, como se
  publica) son 16 MB y sí entra. Después de compilar, antes de medir la precarga: comprimir.
- **Un `cd` dentro de Bash cambia la carpeta de toda la sesión** (pasó varias veces): rutas absolutas o
  `( cd … && … )`.
- **La foto del final se sacaba antes del podio** (la letra se carga al mostrarlo): la prueba espera a verlo.
- **El chip 📶 quedaba puesto en el descanso** (el estado del relevo es de la carrera): ahora solo con la carrera
  andando.
- **Nada encima de la imagen del juego durante toda la carrera.** La primera versión del chip 📶 quedaba puesto mientras
  durara el relevo (con un jugador de red mala, la carrera entera). `prueba-relevo` (tres juegos en una PC) falló 3
  veces seguidas: el retraso de A y B creció a 8-9 cuadros (antes 3-5) y C ya no era el que más pagaba. Con la página de
  antes de M22 (una copia aparte del último commit, el mismo programa) pasó; con la de ahora y los chips apagados
  (`?esquina=0`), también. Explicación: con algo encima del lienzo de WebGPU el navegador ya no lo manda directo a la
  pantalla y compone cada cuadro (más trabajo por cuadro, más tirones). Arreglo: el chip sale 6 s cuando cambia el
  estado y se va solo (como el aviso de antes).
- **El lector de memoria de la página llega hasta 0x81800000** (los 24 MB de la Wii y la memoria grande desde
  0x90000000): lo que Retro Rewind deja más arriba (0x818…) se lee como 0. Las skins las copia el C++.
- **Las pruebas no corren las carreras enteras** (pregunta del dueño): `mkwTerminarEn` hace que todos crucen la meta
  por código en el mismo cuadro, unos 3 s después de largar. Lo largo de `prueba-sala` son las esperas que la prueba
  mide a propósito (el descanso de 30 s, el plazo DNF de 30 s); `--rapida` las acorta (descansos de 25 s, la carrera 2
  también por código) para repetir lo demás en ~2,5 min.
- **Un arreglo rápido rompió «echar» en el sitio.** Al echado ya no se le arma la caja de invitar (`panelEspera` devuelve
  vacío), pero el sitio igual le ponía el clic al botón «Copiar» de esa caja: un error (`onclick` de algo que no existe)
  cortaba la actualización y la página de Piloto Dos se quedaba con el juego andando. Lo encontró el ensayo del sitio
  (`prueba-experiencia`); ahora el clic se pone solo si la caja está.
- **El modo inmersivo esconde la tira**: para echar con la copa andando, el anfitrión sale con «Salir» (el ensayo lo
  hace igual que una persona).
- **`prueba-elegir` leía la semilla** del selector, que ahora solo se ve con `?depurar=1`: la prueba abre la página
  con ese parámetro.

### 98.10 Después de probarlo el dueño: la pantalla completa, opcional y apagada

El dueño probó con `jugar.bat`: «hay demasiado lag al abrir la lista de mapas en el host, no debiera poner full screen
automático, esto debiera ser opcional y desactivado por defecto». Qué pasaba: en el modo inmersivo, el sitio pone
encima del juego la cabecera y el botón del chat con **difuminado del fondo** (`backdrop-filter: blur`), que el
navegador recalcula sobre la imagen del juego en cada cuadro; y al pasar a inmersivo el marco cambia de tamaño (el
juego rehace su lienzo) justo cuando la anfitriona abre la lista de copas. Es lo mismo que se midió con el chip 📶
(§98.9): cualquier cosa encima de la imagen cuesta cuadros.

Arreglo (sitio, `colabtex/src/juegos/mkw.js`):

- **«Pantalla completa al empezar»**: un interruptor en el vestíbulo, de cada uno (en su navegador,
  `localStorage` `mkw.inmersivoAlEmpezar`), **apagado por omisión**. Solo si está prendido la sala pasa sola al modo
  inmersivo al empezar la copa. La pantalla completa a mano (el botón del sitio) sigue como siempre.
- Si alguien lo prende, con Mario Kart en pantalla la cabecera y el botón del chat van **sin difuminado** (fondo
  liso), para que cueste lo menos posible.

Pruebas: sitio `mkw.test.cjs` 20/20 (el interruptor apagado por omisión, sin difuminado encima del juego);
`prueba-experiencia` (Piloto Dos lo prende y Uno no: al empezar, solo Dos queda en inmersivo).

## 2026-10-22 · §99 La red según el crítico, la carga de la sala, Intenso e Imposible y el VR por nivel (M23)

**Qué pidió el dueño** (en orden):

1. «Usa un crítico para revisar, solo revisar, que el modo de conexión, protocolos, etc. del modo online sea el óptimo
   en términos de accesibilidad, lag, etc.», «también que revise el handle del lag, desconexión», «si el approach es
   correcto, es el mejor compartir estados», «la idea es que el lag de uno no mate la experiencia de los otros 11» y
   «asegurar que partan a la vez».
2. Después del informe: «la verdad es un SÍ a todo lo recomendado», y «pon una pantalla de carga con progreso para que
   no se laguee el navegador del host al elegir los mapas».
3. «No dejes que en modo multijugador los jugadores vuelvan hacia atrás saliéndose de las pantallas debidas» y «quita
   eso de personalizar a los Mii, se agregará en una futura update».
4. «Creo que en RR hay una opción de intense CPU» → «claro que sí» (un nivel con eso), «haz que el VR dependa del
   nivel de CPU si aplica, reformula las ecuaciones ayudándote de un crítico» y «agrega un nivel por encima de intenso
   para que la CPU literalmente tenga estadísticas no conseguibles por los jugadores… para que sea injusto y difícil».
5. «Si llegas a 70 % weekly usage, para».

### 99.1 La pantalla de carga de la sala (`preparacion.mjs`)

**Qué pasaba.** Medido con una primera visita (`scratchpad/medir-selector.mjs`, el lag de la anfitriona): la lista de
copas aparecía a los 5,0 s, mientras el navegador todavía compilaba los ~700 pipelines de la lista del juego; después
de abrirla, **7 tareas largas que sumaban 1,4 s** (la peor de 0,54 s): la lista se trababa.

**Qué se hizo.** La sala espera detrás de la cortina con una **barra de progreso** por etapas (la página y el programa
0→35 %, los pipelines que llegan según lo que escribe aurora 35→85 %, la primera pantalla del juego 90 %, y **un segundo
entero sin tareas largas** 100 %), con textos («Bajando el juego», «Preparando los gráficos (la primera vez tarda
más)», «Casi listo…»). Recién entonces la anfitriona ve la lista y corre el reloj de la copa (`sala.copaLista()`).
Topes: a los 45 s, o 8 s después de lo demás sin calma, se da por lista igual. `?preparacion=0` = como antes.

**Resultado:** la lista aparece a los 9,8 s (detrás de la cortina con la barra) y después **3 tareas largas, 241 ms en
total, la peor de 90 ms**. Banco `preparacion` (15).

### 99.2 Los controles de la sala y el editor de Mii

- En la sala nadie puede volver atrás de la pantalla de personajes (B) ni pausar (START): `controles.filtro` quita esos
  botones antes de mandarlos al juego (B solo en la sección 0x49, página 0x6B). `?atras=1` = como antes. Banco
  `controles` (45); `prueba-sala` lo comprueba con el juego.
- «Mi Mii» (el editor) queda escondido para una actualización futura: `EDITOR_MII` de `interfaz.mjs` (`?editorMii=1`
  lo muestra). Los Mii invitados de §86 siguen.

### 99.3 El crítico de la red

Un crítico aparte (sin esta conversación) leyó la malla, el lockstep y la sala, y simuló 12 consolas. Lo central:
**compartir botones (lockstep) es el enfoque correcto** para un ejecutable traducido entero (compartir el estado
haría falta reescribir el juego); lo que falla es **cómo se reparte el lag de uno**:

| | Qué encontró | Qué se hizo |
|---|---|---|
| C1 | Un tirón o corte de uno congela a los 12 (lo que dura el tirón, o 2 s) | el relevo rápido (99.9) |
| C2 | La autoridad (de la que dependen todos) es el mando 0, sin mirar si es estable; pasa el papel tarde | 2 ratos malos de 20 (etapa A) y por estabilidad (99.7) |
| C3 | El que se traba seguido queda atrás para siempre y pierde el control de su kart | ponerse al día (99.8) |
| C4 | La largada espera al lento hasta 45 s | la largada pareja (99.6) |
| C5 | La sincronía frena a todos por el peor | frenarse solo si voy adelante de más de la mitad (etapa A) |
| H1 | Sin TURN: hay pares de PC que nunca se conectan | TURN del Worker y STUN de Cloudflare (etapa A) |
| H2 | Si el anfitrión desaparece sin «Abandonar», la copa se cuelga | la toma (99.5) |
| H5 | Se manda 4-8 veces más de lo necesario | paquetes con acuse (etapa A) |
| H6 | Una conexión que tambalea se da por muerta | ICE restart (etapa A) |
| H7 | Una pestaña escondida tironea a la sala | no frenarse con la pestaña escondida (etapa A) |
| H8 | El que se desconectó ve «Esperando a X» | «Se cortó TU conexión» (etapa A) |

El informe completo, con sus simulaciones, quedó en el scratchpad de la sesión (`critica-red.md`).

### 99.4 Etapa A: lo chico de la red (`lockstep.mjs`, `malla.mjs`)

- **Paquetes con acuse (tipo 15):** cada paquete de botones dice hasta qué cuadro tengo seguidos los del otro; cada uno
  manda solo lo que le falta al otro (antes, siempre los últimos 16 a todos: ~218 bytes por cuadro a cada uno con 12).
- **La autoridad pasa el papel** si la mayoría la vio mal 2 ratos de los últimos 20 (10 s), no 4 seguidos.
- **La sincronía** frena solo si voy adelante de más de la mitad (y por lo que voy adelante del de la mitad); con la
  pestaña escondida no se frena nadie.
- **«Se cortó TU conexión»**: si no llega nada de nadie hace 1 s, el cortado soy yo.
- **Malla:** STUN de Google y de Cloudflare; TURN del Worker (`relevoBt3()` del sitio → mensaje `turn` →
  `malla.ponerIce`); una conexión «disconnected» se reengancha con ICE restart a los 1,5 s y se rearma a los 5,5 s;
  cola UDP de 8 KB en la sala.

### 99.5 Etapa B: si el anfitrión desaparece (sitio, `mkw.js` y `motor.js`)

Si a la anfitriona se le corta internet o se le cuelga Chrome, nadie escribe «abandona» y la copa queda colgada (solo
ella la hace avanzar). Ahora, con la copa andando, cada página mira la presencia de la anfitriona en el buzón (Firebase
la borra sola al desconectarse): si falta más de 15 s, todas eligen al mismo reemplazo (el primero de la copa que
sigue presente), se lo avisan a su juego (`cambiarAnfitrion`, que ya existía) y el reemplazo anota `{t:"toma", de}` en
la sala; vale solo con la copa andando y si `de` es quien manda (una toma vieja no hace nada). Prueba del sitio nueva
(21 en `mkw.test.cjs`).

### 99.6 Etapa C: la largada pareja (`lockstep.mjs`, `sala-carrera.mjs`)

- **Al que no carga**, cuando ya cargó al menos la mitad, se lo espera a lo más **15 s** (antes 45): larga «fuera» y
  entra en la siguiente (como quien recarga).
- **El último en cargar espera media ida y vuelta** antes del cuadro 0 (a lo más 150 ms): los demás, que lo esperan,
  corren el cuadro 0 recién cuando les llega lo suyo, así todos ven la cuenta a la vez.
- **En la cuenta regresiva, todos con al menos 6 cuadros de retraso** (el turbo de salida pide la misma anticipación
  a todos); al «¡YA!» cada uno baja al suyo. La página dice cuándo es la cuenta (Raceinfo +0x28 < 2).
- **Reloj común estilo NTP** con la anfitriona (cada latido lleva mi hora; ella contesta con la suya; se descuenta la
  ida). `sala.desfase` para las pruebas.

### 99.7 Etapa D: la autoridad por estabilidad

**El error que lo mostró.** `prueba-relevo` (tres pestañas, C con la red mala de llegada) falló 9/10: la autoridad
pasó el papel a **C**, que desde afuera se veía bien (lo suyo sale a tiempo) pero **recibía todo tarde**: inventaba
los botones de A y B, sanos, y los obligaba a subir su retraso (A 10, B 12, C 6).

**Qué se hizo.**

- Cada consola lleva, de cada uno, sus últimos 20 ratos: si la mayoría lo vio mal, y cuánto **va atrás** de mí
  (`delanteDe`, la medida de §80b). El papel pasa solo a quien tiene al menos 200 puntos más que la autoridad
  (`puntaje`: −1000 si la mayoría lo ve mal ahora, −100 por rato malo, −300 por cuadro que va atrás, y algo a favor de
  la holgura) y **no tiene la red claramente peor** (su ida y vuelta típica, que ahora viaja en cada informe: más del
  doble y 20 ms más que la mía = no).
- Primero probé con «recibe mal = ve tarde a la mayoría»: no sirve, porque con uno lento y uno de red mala el sano
  también «ve tarde a la mayoría». Lo que sí distingue es la ida y vuelta: el de la red mala la tiene alta **con todos**.
- **Entre carreras:** cada consola manda en su «terminé» cuántos ratos malos tuvo (la mayoría la vio mal, iba atrás) y
  su ida y vuelta; la anfitriona elige como primera autoridad de la carrera siguiente a la de menos
  (`estado.autoridad`), y todas la usan desde el cuadro 0 (`fijarCarrera(n, fuera, autoridad)`).

**Resultado:** `prueba-relevo` 10/10 (A 4, B 5, C 9). Banco `relevo`: la autoridad lenta pasa el papel a Beto y no a
Carla (que recibe todo tarde), y la sala elige la primera autoridad igual en las tres.

### 99.8 Ponerse al día (C3): el reloj del runtime

**Qué pasaba.** Mario Kart Wii no se pone al día: si un cuadro tarda, el siguiente va a su hora. La consola que se
traba seguido queda atrás para siempre, la relevan, la autoridad inventa sus botones y **ya no maneja**.

**Qué se hizo.**

- **Runtime (`vi.cpp`, en `parches/runtime-web.diff`):** `mkw_prisa(ms)` le pide al programa ganar esos ms de grilla:
  en la espera de cada cuadro (sin el enganche al monitor, como en la sala) la grilla del retrace se corre para atrás
  lo que iba a esperar, así el retrace siguiente toca enseguida y el juego corre cuadros seguidos, **dibujándolos
  todos**. `mkw_prisa_ganada()` dice lo ganado. Solo se cambió la sección de `vi.cpp` del parche (otro archivo del
  runtime tiene cambios a medio hacer de otra sesión, `audio_backend.cpp`: no se tocó) y se comprobó que el parche se
  aplica limpio sobre el runtime original.
- **Lockstep:** dos maneras de pedirlo. (1) **El tirón propio**: la pausa entre dos cuadros (sin contar las esperas a
  los demás ni los frenos) menos un cuadro es lo que quedé atrás: se pide **en el momento**. (2) **Medido**: si voy más
  de 3 cuadros atrás de más de la mitad, lo que falta menos 2 (una vez cada dos ratos). `?alDia=0` = como antes.
- **La primera versión solo medía** (2) y era lenta: las medidas de los demás llegan con hasta 0,75 s de atraso, y con
  tirones de 300 ms cada 1,5 s Carla seguía 5-12 cuadros atrás. Con (1), **0,7 cuadros** en promedio, ningún botón
  inventado y retraso 3-5 (sin ponerse al día: 16-83 cuadros atrás y cientos inventados).
- **Trampa del runtime:** el primer corrimiento de la grilla estaba solo en la espera de cada cuadro
  (`PaceToRetraceBoundary`), y en el juego no ganaba nada: cuando la consola va atrás, el cuadro no se espera ahí
  (ya pasó un retrace mientras se armaba) sino en la espera ociosa, donde los retrace avanzan con el reloj
  (`AdvanceDueRetraces`). Ahí se agregó: mientras hay algo por ganar, el retrace siguiente toca ya (uno por vez: cada
  retrace es un cuadro del juego). Medido en `prueba-relevo`: B, trabado 1,5 s, **ganó 4,9 s** y volvió a manejar.
- Tope: 120 cuadros por pedido (2 s, lo que acepta el runtime).

### 99.9 El relevo rápido (C1)

**Qué pasaba.** Un tirón de uno (una pestaña trabada) congelaba a los 12 lo que durara el tirón; un corte, el margen
entero de 2 s.

**Qué se hizo.** A los **150 ms** de esperar a alguien que además está **callado** (no llega nada suyo, ni pings), su
decisor lo **pausa** con el mismo corte en dos fases de §80, sin esperar su respuesta (el callado es él): desde el
cuadro decidido su kart va con el **botón calculado** (el último que se usó para él, con el acelerador y el volante
que se suelta en 60 cuadros), igual en todas las consolas, y nadie lo espera. Cuando vuelve (y se puso al día) le pide
a su decisor volver; el decisor fija el cuadro de la vuelta 60 cuadros más adelante (a todos les tiene que llegar
antes de correrlo) y desde ahí maneja otra vez. Si en 20 s no volvió, la pausa pasa a ser el corte de siempre. Un
pausado deja de ser autoridad en esa carrera. Mensajes nuevos: el aviso de pausa (el del corte con una marca),
«quiero volver» (16) y «vuelve desde r» (17, que dice de qué pausa es). Lo ve en su página: «📶 Tu PC o tu conexión se
trabaron: tu kart siguió solo un momento…». `?relevoRapido=0` = como antes.

**Las trampas (se encontraron reproduciendo en Node, `scratchpad/pausa-node2.mjs`, 50 corridas con pérdida y demoras):**

1. **El que se trabó, al despertar, corría cuadros con sus botones antes de enterarse de su pausa** y su copia se
   separaba (se salía de la carrera). Dos protecciones: después de un tirón propio, antes de seguir, deja pasar los
   mensajes que llegaron mientras estaba trabado; y cada paquete de botones que le mandan lleva la **marca «pausa en
   camino»** mientras su pausa está propuesta o abierta: al verla se queda quieto en el cuadro que ya corrió.
2. **Los avisos repetidos de una pausa vieja se aplicaban a una pausa nueva** («vuelve en el 201» cerraba otra pausa):
   ahora la vuelta dice de qué pausa es, y un aviso repetido no toca nada.
3. **Paquetes viejos con la marca llegaban después de la vuelta** y lo dejaban quieto otra vez: se ignora la marca 2 s
   después de saber una decisión propia.
4. **Una regla vieja cortaba al pausado** («al relevado que se calló, cortarlo»): a un pausado no se lo releva ni se lo
   corta por callado.
5. **Con una red que pierde paquetes se pausaba a quien no estaba callado** (le faltaban botones pero sus pings
   llegaban): no se enteraba a tiempo y quedaba fuera. Ahora solo se pausa al callado; al otro se le piden de nuevo.
6. **Con el juego, la traba de 3 s terminaba en corte**: después de la primera traba la autoridad lo relevaba, nadie lo
   esperaba, y la regla «relevado y callado 2 s → cortar» lo sacaba. Con el relevo rápido, al relevado callado se lo
   pausa a los 150 ms.
7. **Una propuesta vieja lo bloqueaba 4,5 s**: si la pausa llegaba antes que su propuesta (en el banco, los mensajes
   de una pestaña trabada llegaban desordenados al despertar), la propuesta lo dejaba quieto. Una propuesta de alguien
   ya pausado ya no bloquea (y el banco respeta el orden del canal confiable).
8. **Pedía volver todavía atrás**: con la medida vieja (recién despierto) pedía la vuelta enseguida, y al llegar al
   cuadro de la vuelta A lo esperaba otra vez. Ahora pide volver cuando terminó la ráfaga para ponerse al día.

**Resultado (banco `relevo`, con el reloj de verdad):** con la pestaña de Beto trabada 1 s, Ana esperó **184 ms** (sin
el relevo rápido: 983 ms); Beto volvió a manejar; las tres, la misma carrera. Si Beto se va, lo pausan y la pausa pasa
a corte en el mismo cuadro en Ana y Carla. **Con el juego** (`prueba-relevo`): B trabado 1,5 s → A esperó 317 ms en ese
rato (antes ~1,5 s); B trabado 3 s → ya no se lo corta: pausado y de vuelta.

**Otra cosa que mostró `prueba-doce`:** la prueba agendaba la meta 90 cuadros después de una lectura vieja y, con 12
juegos en una PC, las comprobaciones de en medio tardaban más que eso: el cuadro ya había pasado y la carrera no
terminaba nunca (la prueba duró 5,9 min). Ahora la agenda con una lectura fresca y 300 cuadros de margen (11/11 en 2,0
min).

### 99.10 Intenso e Imposible (M23, `cpu_dificultad_nativo.cpp`, `dificultad-cpu.mjs`)

**La investigación** (un agente, leyendo el código traducido y los `.bin`; nada copiado):

- El **Hard AI** de Retro Rewind cambia una sola cosa: la tabla de velocidad de la IA. Pulsar envuelve la carga de
  `kartAISpdParam.bin` (`rr_kamek_81830C50`): si el ajuste guardado 0x63001 vale 1, pide `kartAISpdParamRR.bin`
  (cadena en 0x8186DD24). Con ella, a 150cc la base de la CPU es 170: va **siempre pegada al tope de 120**.
- El tope no es de la IA: es el **tope duro de cada kart** (`Kart::Movement +0x2C`), copiado del global
  `Kart::hardSpeedCap` (0x808B59F4 = 120 × el factor de Pulsar), y frena el motor y la física.
- Cada kart tiene **su copia de estadísticas** (`Kart::ComputeStats`, 0x18C bytes), creada por
  `ApplyPlayerStatChanges` de Pulsar (`rr_kamek_81839710`, r28 = el número de jugador, r3 = la copia).

**Qué se hizo.**

- **Intenso** = la tabla del Hard AI elegida **por nosotros** (envoltura de `rr_kamek_81830C50`, que llama directo a
  `ArchiveMgr::GetFile` sin mirar el ajuste guardado; de paso arregla un riesgo: un guardado de RR importado con Hard
  AI prendido cambiaba la tabla de una sola consola y desincronizaba la sala), más los objetos del humano.
- **Imposible** = Intenso y, **solo en los karts de CPU**: tope ×1,15 (138 a 150cc; no más de ×1,20, porque la bala va
  a 145), velocidad base ×1,15, las cuatro aceleraciones y las dos de derrape ×1,5, miniturbo ×1,5. Las estadísticas
  se escriben al crear el kart; el tope **cada cuadro** (envoltura de `rr_overlay_8057B9BC`, UpdateAcceleration),
  porque las funciones que lo devuelven al global están copiadas en línea.
- `kFilaDelJuego` con 6 niveles (`directo_nativo.cpp`), el mapa de la ficha (`directo.mjs`), `mkw_cpu_perfil_kart`
  (`dificultad-cpu.mjs`) y `mkw_cpu_estado` 14-19 para mirar. Sin el programa nuevo, Intenso e Imposible corren como
  Máximo. El sitio: `MKW_NIVEL` con 6 y su ayuda.

**Lo que se esperaba (a 150cc, en recta):** Máximo ~86 (parejo con el mejor humano, 86,1), Intenso **120** (+39 %),
Imposible **138** (+60 %).

**Medido** (`node herramientas/medir-cpu-niveles.mjs --etiqueta m23 --combos c150:maximo,c150:intenso,c150:imposible`:
12 CPU, 4 pistas × 2 semillas, el mismo kart en el mismo instante de la misma carrera):

| | vueltas por minuto (media) | la ganadora (s) en 0.0 · 13.2 · 20.2 · 30.2 | contra el nivel de abajo |
|---|---|---|---|
| Máximo | 1,445 | 116,9 · 162,5 · 138,3 · 138,5 | — |
| Intenso | 1,605 | 100,8 · 141,9 · 119,8 · 121,1 | **+10,5 %** recorrido (la ganadora, −13 %) |
| Imposible | 1,783 | 87,4 · 130,8 · 108,4 · 108,5 | **+11,0 %** sobre Intenso; **+21,9 %** sobre Máximo (la ganadora, −22 %) |

Los ganchos actuaron en todas: Intenso con la tabla de RR (adv 100: base 170); Imposible con el tope en 138, los 12
karts de CPU mejorados, sin fallos de la tabla. La ganancia en la carrera es menor que la de la recta (+39 % / +60 %):
también cuentan las curvas, los choques y los objetos, y Máximo ya iba con sus bonos. El mismo kart fue más lento en
Imposible que en Intenso en 8 de 96 comparaciones (caídas o choques a más velocidad): no es la regla.

### 99.11 El VR según el nivel (la regla v2, `vr-sala.mjs`)

Un crítico (otro agente) revisó la regla de §95/§96 con los 6 niveles. Lo que encontró:

- **Error real:** `anclaCpu` recortaba el nivel a 0..3: Intenso e Imposible contaban como «máximo» (ancla 9400) y, contra
  CPU a las que nadie les gana, eso llevaba a todos a ~2800.
- **No existe un ancla buena para un nivel al que nadie gana:** funcionaría como un **imán** (todos al mismo VR).
- **La lotería:** con la CPU 6599 o más por encima, perder costaba 0 y ganar pagaba hasta 112 (subía a los
  principiantes de 849 a 2634 en máximo).
- Solo con CPU (el otro humano «fuera» en el cuadro 0) se cobraba la parte entera de las CPU; una **cuenta alterna
  quieta** daba de +500 a +2600; con un `.wasm` viejo se contaba «máximo» aunque corrieran como «normal»; se truncaba
  hacia el cero; no había tope por carrera.

**La regla v2** (adoptada tal cual la recomendó; las anclas de difícil y máximo bajan a 7300 y 9000):

- Entre humanos, la regla del juego sin tocar.
- Fácil a Máximo: la de §95 con **zona muerta** (si perder no cuesta, ganar no paga), redondeo al entero más cercano y
  **fusible** de ±112 para la parte de las CPU.
- Intenso e Imposible («fuera de escala»): las CPU no ponen ni sacan VR; entre cada par de humanos, la **segunda
  llegada** (gana quien le ganó a más CPU; a igual VR, 16 y 24), de suma cero.
- Con menos de 2 humanos, nada. Quien no tocó un botón 30 s seguidos en el primer minuto es un **ausente** = cortado
  (`lockstep.estado().quieto`). El VR usa el nivel que el gancho dice que **aplicó** (`_mkw_cpu_estado(2)`); si no es el
  pedido, las CPU no cuentan.

Ejemplo (2 humanos de 5000 + 10 CPU), 1.º / 12.º: fácil +25/−65 · normal +39/−39 · difícil +69/−23 · máximo +101/−17 ·
intenso +29/−29 · imposible +37/−37 (si los dos quedan detrás de las 10 CPU: ±13, el par). Banco `vr-sala` 58 (6
cambiados, 13 nuevos); `prueba-vr` (la curva contra el juego) igual.

### 99.12 Pruebas

| Prueba | Resultado |
|---|---|
| Bancos `lockstep` / `relevo` / `sala-carrera` / `red` / `sala-playlist` | 47 / 38 / 77 / 28 / 37 (todos a la vez, 9 de 9 páginas) |
| Bancos `preparacion` / `controles` / `dificultad-cpu` / `vr-sala` | 15 / 45 / 28 / 58 |
| Sitio `mkw.test.cjs` + `mkw-worker.test.cjs` | 27 / 27 (los 5 que fallan en el sitio entero son de otros juegos: el salón, «bots-mkw», los marcos de campeón) |
| `prueba-sincro --directa --cpu=intenso` / `--cpu=imposible` | 13 / 13 (huellas iguales en las dos pestañas) |
| `prueba-vr` | 6 / 6 |
| `prueba-doce --n 12` | 11 / 11 (2,0 min) |
| `prueba-sincro --directa --cpu=imposible` (con el reloj nuevo) / `prueba-sala --rapida` | 13 / 42 |
| `prueba-relevo` | 10 / 10 y 9 / 10 según la corrida: la espera de A en la traba de 1,5 s varía (317-1075 ms; ver 99.13) |

### 99.13 Lo que queda

- Medir Intenso e Imposible también en 200cc (`--combos c100:intenso,c100:imposible`) y leer la velocidad de cada
  kart en la herramienta (hoy mide el recorrido), para ver si la IA a 138 se cae más en pistas cerradas (si pasa: tope
  ×1,10 o giro ×1,15).
- ✅ **Hecho en §100.5.** **Pedir copa** (pedido del dueño, después de §99): mientras la anfitriona elige la copa, los demás pilotos pueden
  **solicitar una** en vez de esperar sin ver nada; ella ve las solicitudes y elige (como las sugerencias de la
  playlist, §74, pero para la copa).
- ✅ **Arreglado en §100.1.** **Un error que vio el dueño con `jugar.bat`**: se desconectó de un jugador justo al empezar la carrera; cuando la
  cuenta llegó a 0 no pasó nada y quedó pegada (debe seguir con los que quedan). Por revisar: la desconexión en la cuenta
  regresiva, y el caso en que el que se fue era la anfitriona (con dos, no hay otro par para reenviar los mensajes de la
  sala, H1.4).
- ✅ **Hecho en §100.2** (11 casos). **Un banco de desconexiones** (pedido del dueño): los distintos casos (antes de cargar, en la cuenta, en carrera, en el
  descanso, en la elección; el que se va es la anfitriona, la autoridad o un piloto común; se cae solo el WebRTC o también
  el buzón; vuelve o no; 2, 3 y 12 pilotos) y qué debe pasar en cada uno.
- ✅ **Hecho en §100.6.** **Mandos como los otros juegos del sitio** (pedido del dueño): que Mario Kart tome los mandos igual que el resto de
  Juegos (la misma detección, configuración y avisos del sitio), además de lo que ya hace la página del juego.
- ✅ **Hechos en §100.4, §100.3 y §100.7.** Del crítico de la red, sin hacer todavía: **H1.4** (reenviar los mensajes de la sala por otro par cuando dos no se
  hablan), **H9** (el estado de la sala solo cuando cambia, con un latido que lleva la versión), **H1.2** (la prueba
  de conexión en el vestíbulo, 🟢/🛰/🔴 por piloto). (**S3** ya está: la anfitriona acepta el «terminé» solo de un
  humano de la sala que corrió esa carrera, no de uno que quedó fuera desde el principio; bancos `sala-carrera` 77 y
  `sala-playlist` 37.)
- **La espera de A en la traba de 1,5 s de `prueba-relevo` varía** entre 0,3 y 1,1 s según la corrida (con tres juegos en
  la misma PC; sin el relevo rápido es la traba entera). La prueba ahora dice a quién esperó cada uno en ese rato
  (`esperaDe`): mirar si es a B (la pausa tarda) o a C (la de la red mala).
- **La sincronía y ponerse al día se pisan un poco**: el que va adelante se frena por el de atrás, que además se pone
  al día; el que se frena manda sus botones más justos y su retraso sube (`prueba-relevo`, «C paga su conexión», a veces
  falla por eso: A sube a 7). Revisar el umbral de la sincronía ahora que existe ponerse al día.
- Compilar el programa final y subirlo a R2 (lo hace el dueño cuando diga).

## 2026-10-24 · §100 La carrera pegada al irse alguien, el banco de desconexiones, «Pedir copa», los mandos del sitio y lo que faltaba de la red (M24)

**Qué pidió el dueño** (en orden):

1. «Agrega a la lista que los otros jugadores pueden solicitar copa en vez de esperar sin ver».
2. «Me desconecté de un jugador cuando empezaba la partida, cuando el contador llegó a 0 no pasó nada, se quedó pegado,
   debiera seguir jugando con los que quedan».
3. «Es para futuro también un banco de pruebas de distintos casos de desconexión y cómo hacer handling».
4. «Agrega a la lista el soporte de mandos como lo hacen los otros juegos».
5. «Sí, sigue con H1.4, H9 y H1.2» (lo que quedaba del crítico de la red, §99.3), y después «ok terminemos el juego»
   y «dale nomás, gasta todo».

### 100.1 La carrera pegada: la sala la hace avanzar solo la anfitriona

**Qué pasaba.** La sala (`sala-carrera.mjs`) tiene una sola página que decide: la de la anfitriona. Ella mira los
relojes (los 45 s de elegir personaje, los 30 s del descanso) y, cuando uno llega a 0, cambia la fase y se lo reparte a
todos. Las demás solo obedecen. Si la que se va es justo la anfitriona, el reloj de los demás llega a 0… y nadie lo hace
avanzar: la pantalla queda quieta para siempre. Es lo que vio el dueño. El sitio ya tenía un reemplazo (§99.5: si la
anfitriona falta 15 s del buzón de la sala, el sitio nombra a otra), pero llega tarde y depende del buzón de Firebase.

**Qué se hizo** (dentro del juego, sin esperar al sitio):

- **Anfitriona provisoria.** Cada página mira hace cuánto no le llega nada de la anfitriona. Si son más de **4 s** y
  además «se fue» (ver abajo), o más de **10 s** aunque siga en el buzón, manda la primera de la sala, en su orden, que
  sigue y se oye (puede ser una misma). Todas hacen la misma cuenta, así eligen a la misma sin hablarse. La nueva sigue
  desde su última copia del estado, con un número de versión más alto (para que nadie la tome por vieja), y el plazo que
  corría se pasa a su reloj (era una hora del reloj de la anfitriona de antes: se le resta la diferencia medida).
- **«Se fue».** Una página se fue si ya no está en el buzón de la sala **y** su conexión directa (WebRTC) no está sana
  (`consolaSeFue` en `mkw.mjs`). Solo entonces se la reemplaza a los 4 s; si solo se calló (la pestaña trabada), se la
  espera 10 s, porque puede volver.
- **Al cerrar la pestaña, avisa.** `pagehide` → `malla.salir()`: se borra del buzón en el momento, en vez de esperar a
  que Firebase note que se cortó.
- **La anfitriona del sitio manda.** El sitio sigue siendo quien nombra a la anfitriona oficial (`oficial`). Si la oficial
  vuelve (se le arregló la red) y su latido dice que manda ella, todas le devuelven el mando; si su copia es más vieja,
  pide la nueva (`dame`/`copia`, §75).
- **Una pestaña congelada no reemplaza a nadie.** Si el reloj interno de la página dio un salto de más de 3 s (la
  pestaña estuvo trabada o la PC durmió), ese primer tic no cuenta: lo que mandó la anfitriona todavía está en la cola.
- **La carrera tampoco espera al que se fue.** En la carrera (`lockstep.mjs`), al que se fue (1 s sin oírlo y «se fue»)
  se lo corta sin el margen de quien puede volver. Antes, al irse alguien **mientras cargaba la pista**, los demás lo
  esperaban hasta 15 s (la espera de la largada pareja de §99.6).
- **Ausentes.** Quien se fue hace más de 4 s queda fuera de la carrera siguiente (`ausentes()`), sin esperar los 10 s de
  silencio de siempre.
- **El aviso equivocado.** Cuando el otro piloto cerraba su pestaña, al que quedaba se le decía «Se cortó TU conexión».
  Ahora, si se fueron todos los demás del buzón (`seFueronTodos`), el aviso habla del otro.

Como un tablero con un relé maestro: si el maestro deja de dar señal, el siguiente de la lista toma el mando, y se lo
devuelve cuando el maestro vuelve.

### 100.2 El banco de desconexiones (`prueba-desconexion.mjs`)

Una prueba con el juego de verdad que abre 2 o 3 pestañas como computadores de una sala (A es la anfitriona) y, en cada
caso, una se va en otro momento y de otra manera. Mide si la sala sigue (quién manda, si la carrera abre, si corre) y
cuánto quedó quieta la pantalla de los que siguen. Al empezar cada caso, además, todas tienen que verse 🟢 (100.7).

| Caso | Quién se va, cuándo, cómo | Qué tiene que pasar |
|---|---|---|
| `elegir-anfitriona` | A, eligiendo personaje, cierra la pestaña (lo del dueño) | B manda; al llegar el reloj a 0 abre la carrera sin A |
| `elegir-otro` | B, eligiendo, cierra | La carrera abre sin B |
| `carga-otro` / `carga-anfitriona` | B / A, cargando la pista, cierra | La carrera arranca sin esperarlo 15 s (quieta ≤ 8 s) |
| `cuenta-otro` | B, en la cuenta regresiva, cierra | Quieta ≤ 3 s |
| `carrera-anfitriona` | A, en plena carrera, cierra | Quieta ≤ 3 s; B manda y abre la carrera 2 |
| `descanso-anfitriona` | A, en el descanso, cierra | B manda y abre la carrera 2 sin A |
| `rtc-anfitriona` | A, eligiendo; se parte solo la conexión directa (sigue en el buzón) | Cada una sigue sola (A con su sala, B como provisoria a los ~11 s) |
| `red-tres` | C (de 3), en carrera, se le corta internet | A y B siguen (quieta ≤ 3 s); C sigue sola con las CPU |
| `anfitriona-tres` | A (de 3), cargando, cierra | B manda en B y en C |
| `par-tres` | Se parte solo la conexión A ↔ C (de 3), eligiendo | Nadie reemplaza a nadie; la sala le llega a C por B; las tres corren (100.4, 100.7) |

Ganchos solo para la prueba: `window.mkwCortarRed('todo' | 'rtc', uid?)` (`malla.cortar`: sale del buzón y cierra
todo, o solo las conexiones directas, o solo la de un piloto). Uso: `node web/navegador/prueba-desconexion.mjs
[--casos=a,b] [--lista] [--puerto=8166]` (~25 min todos); lo que anotó la red de cada pestaña queda en
`build/web/datos/desconexion/`.

**Trampas.** La prueba primero revisaba las pestañas de a una, y la segunda medía su tiempo contando la espera de la
primera (B «tardaba» 56 s en mandar): ahora se revisan todas a la vez. En el descanso, la anfitriona que se fue no
quedaba fuera de la carrera 2 (`ausentes()` no miraba «se fue»). Y `mkwTerminarCarrera` no sirve en la sala (la carrera
de la sala termina con `mkwTerminarEn`, §75).

### 100.3 H9: el estado de la sala solo cuando cambia

Antes, la anfitriona mandaba **el estado entero** de la sala a cada piloto **cada segundo** (con 12 pilotos y la lista de
la playlist, decenas de KB por segundo que casi siempre eran lo mismo). Ahora lo manda cuando cambia y, por si se perdió
algo, cada **5 s** (`REFRESCO_MS`). Cada latido (el «aquí estoy» de cada página, cada 1 s) lleva el número de versión que
tiene (`v`) y si ya sabe en qué va la sala (`l`); si la anfitriona ve uno atrasado, se lo manda en el momento. Como pasar
de un muestreo continuo a uno por evento con un refresco lento de seguridad.

**Trampa.** Una página recién abierta con versión 0 frente a una anfitriona también en 0 nunca recibía nada (no estaba
«atrasada»): por eso el latido lleva `l`, y sin `l` se le manda igual.

### 100.4 H1.4: los mensajes de la sala por otro piloto

Si la conexión directa entre dos se parte pero los dos siguen conectados con un tercero, los mensajes de la sala dan un
salto por ese tercero (`{t:'via'}`, un salto solo, nunca más):

- cada latido dice a quién tiene cada uno de anfitriona y hace cuánto la oye directo (`j`, `oj`);
- quien oye a la anfitriona directo le pasa sus repartos a quien dice que no la oye hace más de 3 s (`VIA_MS`);
- lo que uno le manda a la anfitriona (lo que eligió, «terminé», su VR, la copa que pide) va por un puente si no la oye
  directo (el primero, en el orden de la sala, que sí la oye);
- **(nuevo con H1.2, 100.7) el latido del que no oye a la anfitriona también se lo pasa el puente.** Sin esto, la
  anfitriona lo daba por ausente a los 10 s y lo dejaba fuera de la carrera siguiente, aunque la sala le llegaba bien.
  El banco lo prueba: con Ana ↔ Caro partida 26 s y Caro callada 12 s, la carrera empieza con Caro adentro. Con el reenvío
  apagado, el mismo banco da «fuera: caro».

Como un repetidor de radio: si dos estaciones no se ven, una tercera que ve a las dos repite lo que dicen.

### 100.5 «Pedir copa»

Mientras la anfitriona elige la copa, los demás ya no esperan sin ver nada: abajo aparece **«Pedir una copa»**
(`#accionJuego`), que abre el mismo selector de copas con el botón «Pedir la Copa N» en lugar de «Jugar». El pedido va a
la anfitriona (`{t:'pido', copa}`, vale solo en la fase de la copa y sin playlist) y queda en el estado de la sala
(`pedidas`, uno por piloto: vale el último), así lo ven todos. En el selector de la anfitriona, cada copa pedida lleva
quiénes la piden (`🙋 Beto, Caro`) y arriba hay una fila de atajos («🙋 Copa 8 · Beto, Caro») que la marcan con un clic.
Si el reloj de la copa (90 s) se acaba sin que elija, sale **la más pedida** (`copaMasPedida`: la que más piden; si
empatan, la del que está más arriba en la sala) en vez de una al azar. Al pasar a elegir personaje, los pedidos se borran.

### 100.6 Los mandos como en el resto de Juegos (`mando-sitio.mjs`)

La página de Juegos carga `juegos/audio/mando.js`: con un mando conectado y ningún juego que lo configure, maneja un
**cursor** en la página (el stick lo mueve, A hace clic, B vuelve atrás). Con Mario Kart en su marco, ese cursor andaba
encima del juego y cada A del mando también hacía clic arriba. Los otros juegos del sitio cargan **su propia copia** de
mando.js dentro de su marco; la de arriba lo nota y se aparta mientras el marco se ve. Ahora Mario Kart hace lo mismo:

- carga la misma copia del sitio (la dirección sale del `<script>` de la página de arriba; fuera del sitio no hay y no
  pasa nada);
- en el juego, mando.js no hace nada: el juego lee el mando solo (`controles.mjs`, como un mando de GameCube);
- en los menús de la página (el selector de copa o de pistas, el zócalo del descanso, el cajón; los diálogos los ve
  mando.js solo) maneja el cursor igual que en los otros juegos, y **mientras tanto el mando no llega al juego**
  (`controles.sinMandos`): un A en «Jugar la Copa» no es también un A en la pantalla de personajes de atrás. El teclado
  sigue igual;
- el aviso del sitio al conectar («🎮 Mando DualSense conectado») muestra los botones de Mario Kart en la letra de la
  familia del mando (✕ ○ □ △ en PlayStation, A B X Y en Xbox, B A Y X en Switch).

`?mandoSitio=0` = sin esto. Como un conmutador de transferencia con dos tomas para el mismo enchufe: nunca están
conectadas las dos.

### 100.7 H1.2: la prueba de conexión de cada piloto (`conexiones.mjs`)

El crítico pedía que cada piloto viera, antes de correr, si llega a los demás. Cada página mira **cada 2 s** su conexión
con cada uno de los otros pilotos de la sala y le pone un ícono:

| Ícono | Qué significa | Cómo se sabe |
|---|---|---|
| 🟢 directa | La conexión WebRTC propia con ese piloto está sana (con su ida y vuelta en ms) | `malla.sano`, y `getStats` de la conexión |
| 🛰 repetidor | También anda, pero pasando por el TURN de Cloudflare (un poco más de demora) | El par de candidatos elegido es de tipo `relay` |
| 🔴 por otro | Sin conexión propia: lo suyo llega pasado por un tercero (100.4). Se juega, pero si ese tercero se va, se pierde | La sala lo oyó hace menos de 3 s, pero no directo (`sala.oido`, que dice también por quién) |
| 🔴 sin | Ni directa ni por otro | Nada en 3 s y más de 15 s sin conexión |
| ⏳ conectando | Los primeros 15 s sin conexión (WebRTC todavía busca camino; también si se le cayó la que tenía) | |

Dónde se ve: en la tira del vestíbulo del sitio, al lado de cada piloto (con el detalle en el título: «Conexión con Beto:
directa · 34 ms»), porque la página se lo manda al sitio cada vez que algo cambia (`{tipo:'conexiones', de}`; la ida y
vuelta cuenta como cambio solo si se movió más de 10 ms desde la última avisada). En la página del juego, los 🔴 salen
6 s en la esquina («🔴 Caro: sin conexión directa (le llega por Beto)»). `?conexiones=0` = sin la prueba.

**Por qué no en el vestíbulo antes de empezar.** Ahí todavía no hay malla: la conexión entre las páginas se arma cuando
empieza la copa, y armar una de prueba en el vestíbulo pediría otra clave en el buzón de Firebase (la de la presencia
ya la usa la precarga, «~40», §98) y cambiar sus reglas, que publica el dueño. La copa empieza con la elección de copa
(hasta 90 s) y la de personaje (45 s): hay tiempo de ver un 🔴 antes de la primera carrera.

**Lo que mostró.** Con A ↔ C partida (`par-tres`), A ve a C «🔴 por B» y C a A igual a los 6 s; B ve a las dos 🟢. Ahí
apareció el hueco de 100.4 (la anfitriona daba a C por ausente): con el latido reenviado, la carrera abre con las tres
y corre sin cortes.

**Trampa.** La primera versión avisaba al sitio cuando la ida y vuelta cambiaba de «decena» (30 → 36 ms ya era otra):
ahora compara con la última avisada, con un margen de 10 ms (como un comparador con histéresis, que no tirita con el
ruido).

Como el probador de continuidad de un tablero: un LED por cable, verde si conecta directo, amarillo si pasa por un
puente, rojo si está cortado.

### 100.8 El «ausente» que ya había llegado (VR v2, §99.11)

La regla del VR v2 dice que quien no toca nada 30 s seguidos en el primer minuto de la carrera es un **ausente** y
pierde como cortado (así una cuenta alterna quieta no junta VR). La carrera cuenta esos cuadros quietos con los botones
de cada humano (`lockstep.mjs`, `quieto`). Pero **cuando alguien cruza la meta el juego deja de pedirle botones** (y la
página los traba, el cerrojo de §94): desde ahí sus cuadros salen «quietos». Quien llegaba antes del minuto y esperaba a
los demás juntaba 30 s quieto y **perdía VR como cortado aunque hubiera ganado**.

Lo encontró `prueba-sala` entera (no se había vuelto a correr desde §99, solo `--rapida`, que termina las carreras por
código antes de los 30 s): en la carrera 2, A llega primera por código a los ~10 s, B no llega y el juego le termina la
carrera 30 s después (la regla DNF). A quedaba con −39 (lo mismo que dan las cuentas de `vr-sala.mjs` con «A cortada») y
B con −28. En una carrera de verdad es raro (casi nadie da 3 vueltas en menos de un minuto), pero en una pista corta de
Retro Rewind puede pasar.

**El arreglo.** El lockstep tiene una opción nueva, `llego(i)`: la página la contesta leyendo del juego si el humano i ya
cruzó la meta (RaceinfoPlayer +0x38, bit 2, el mismo que miran las pruebas). Se lee con el juego parado en ese cuadro,
esperando los botones: es el mismo estado en todas las consolas, así que todas cuentan igual. Desde que llegó, sus
cuadros no cuentan como quietos. La página anota ahora, en `mkwEstado.vr`, por qué contó a cada uno como cortado (los
cortes de la carrera, lo más que estuvo quieto y los ausentes), y `prueba-sala` lo muestra en su detalle.

Medido después: A, que llegó a los ~10 s, quedó con 960 cuadros quieta como máximo (16 s, antes de llegar); nadie
cortado; A +39 y B −41, lo que dan las cuentas con esos puestos. Banco `lockstep`: Beto sin tocar nada junta 300 de 300
cuadros quieto; si «llegó» en el cuadro 50, se queda en 50.

**Trampa.** El primer intento fue arreglar la prueba (que A y B tocaran un botón que no mueve el kart cada 4 s): no
cambió nada, porque A ya había llegado y el juego no recibía sus botones. La prueba los sigue tocando (así B, que no
llega, tampoco es un ausente), pero el arreglo de verdad es `llego`.

### 100.9 Pruebas

`prueba-desconexion.mjs`, los 11 casos con el juego: **95 de 95** (con el reenvío del latido de 100.4 y la prueba de
conexión de 100.7). Lo medido, desde que se va:

| Caso | La sala | La pantalla de los que siguen |
|---|---|---|
| `elegir-anfitriona` (lo del dueño) | B manda a los 4,0 s; la carrera abre al plazo (46-47 s) | — |
| `elegir-otro` | La carrera abre sin B | — |
| `carga-otro` | — | Quieta 1,3 s (antes, hasta 15 s) |
| `carga-anfitriona` | B manda a los 5,0 s | Quieta 0 s |
| `cuenta-otro` | — | Quieta 0 s (la pausa del relevo rápido) |
| `carrera-anfitriona` | B manda a los 4,2 s y abre la carrera 2 | Quieta 0 s |
| `descanso-anfitriona` | B manda a los 4,2 s; la carrera 2 abre a los 7 s | — |
| `rtc-anfitriona` (sigue en el buzón) | B manda a los 11,2 s; cada una corre la suya | — |
| `red-tres` | A y B siguen | Quieta 0 s |
| `anfitriona-tres` | B manda a los 4,3-4,8 s en B y en C | Quieta 0 s |
| `par-tres` (A ↔ C partida) | Sigue A, nadie fuera; A y C se ven «🔴 por B» a los 6-7 s | Las tres corren 600 cuadros sin cortes |

| Prueba | Resultado |
|---|---|
| Bancos `sala-carrera` / `lockstep` / `controles` | 101 / 50 / 47 (con el reenvío del latido apagado, `sala-carrera` da «fuera: caro»: la prueba distingue) |
| Bancos `mando-sitio` / `conexiones` (nuevos) | 10 / 19 |
| Todo lo que va sin el juego (`correr-todo --sin-juego`) | 92 / 93: los 42 bancos menos una comprobación de `relevo` (§11, «Carla cuenta sus ratos de voy atrás»: con la PC ocupada por los 42 bancos juntó 0; sola, 3 de 3 bien con 7-8). Es de §99 y no la tocó nada de esto |
| Sitio `mkw.test.cjs` + `mkw-worker.test.cjs` | 28 / 28 (uno nuevo: la prueba de conexión en la tira) |
| `prueba-desconexion` (nueva, 11 casos) | 95 / 95 |
| `prueba-sala` (entera, con «Pedir copa» y la fila de atajos) | 45 / 45 (antes de 100.8: 44 / 45) |

### 100.10 Lo que queda

- La prueba de conexión también en el vestíbulo, antes de «¡A correr!» (otra clave en el buzón de Firebase y sus reglas,
  que publica el dueño).
- `relevo` §11 (la autoridad por estabilidad) a veces falla con la PC cargada: «voy atrás» depende del ritmo de las
  consolas falsas; darle más cuadros o medir otra cosa.
- Lo de antes que sigue abierto (§99.13): la espera en la traba de 1,5 s de `prueba-relevo`, el umbral de la sincronía
  con ponerse al día, Intenso e Imposible en 200cc, y el programa final a R2 (cuando el dueño diga).

## 2026-10-24 · §101 Afinar la red: la espera en la traba, la sincronía con ponerse al día y el banco `relevo` §11 (M25, punto 1)

El dueño pidió solo el punto 1 de M25 («solo haz 1»): **afinar la red**. Eran tres cosas que habían quedado abiertas
(§99.13, §100.10):

1. en `prueba-relevo`, durante la traba de 1,5 s de B, lo que esperaba A variaba entre 0,3 y 1,1 s (¿a quién esperaba?);
2. la **sincronía de tiempo** (§80b: el que va adelante se frena un poco) y **ponerse al día** (§99 C3: el que quedó
   atrás corre seguido lo que le falta) se pisaban: a veces A subía su retraso a 7 y fallaba «C paga su conexión»;
3. una comprobación del banco `relevo` (§11) fallaba a veces con la PC cargada.

Los puntos 2, 3 y 4 de M25 (Intenso e Imposible en 200cc, la prueba de conexión en el vestíbulo, el programa final a
R2) no se tocaron.

### 101.1 Cómo se midió

Dos herramientas nuevas, para ver adentro de la espera:

- `node web/navegador/prueba-relevo.mjs --trabas=8`: en vez de una traba de 1,5 s en B, ocho en la misma carrera (cada
  5,5 s). De cada una imprime cuánto esperaron A y C y **a quién** (`esperaDe`), desde qué cuadro se pausó a B y si
  hubo cortes, y al final comprueba que A espere siempre menos de 600 ms.
- `?esperasLog=N` (en la página): el lockstep anota en su registro cada espera de más de N ms (por omisión 500), y otra
  vez a los 1,5 s: qué falta, hasta qué cuadro tiene lo de cada uno (con `p` si está pausado y `x` si está cortado), si
  ya llegó lo de la autoridad, los bloqueos y propuestas abiertos, y hace cuánto oyó a cada uno.

Tres corridas de 8 trabas (antes de los arreglos):

| Corrida | Lo que esperó A en cada traba (ms) | C (ms) |
|---|---|---|
| 1 | 64, 84, 86, 284, 310, 345, 374, **1393** | 108 … 442, **1664** |
| 2 | 93, 284, 296, 301, 307, 312, 463, **2854** | 354 … 802, **2958** |
| 3 | 41, 60, 65, 65, 68, 69, 69, 316 | 71 … 114, 357 |

**Lo normal es ~65 ms**, y es el **bloqueo** de la pausa en dos fases: A propone pausar a B, espera que C conteste hasta
qué cuadro tiene lo de B (la respuesta viaja por la red mala de C, 70 ms de ida) y recién ahí sigue. En el detalle sale
como espera «a nadie» (faltan `-1`). La primera traba de cada carrera cuesta más (~300 ms): al principio B tiene el
retraso más bajo y A se queda sin botones suyos antes.

**Las grandes (1,4 y 2,9 s) no eran una espera larga**: el registro no mostró ninguna espera de más de 400 ms en la
carrera. Eran muchas esperas cortas a **C**, una detrás de otra, porque C había bajado su retraso de 12 a 2 sin que nada
lo anotara (bajar el retraso no se registraba). Lo que pasó, leyendo los registros de las tres pestañas:

- Con tres juegos en una PC, B no alcanza a ponerse al día entre una traba y la siguiente: su ráfaga corre a ~1,2 veces
  (la PC no da para más) y en 5,5 s no recupera los 90 cuadros. B fue quedando **80 a 120 cuadros atrás**.
- Desde tan atrás, todo lo de A y de C le llega a B con muchísima holgura (lo necesita mucho más tarde), y sus informes
  decían «a C le sobra holgura». Con ese voto, C bajó su retraso hasta 2.
- Con retraso 2 y 70 ms de red, lo de C empezó a llegar tarde: A lo esperó en ratitos (2,9 s en total), lo relevó, y el
  retraso de C se disparó de vuelta a 12. A, que mientras tanto se frenaba por C, subió el suyo a 7.
- Encima, una vez **B se trabó justo mientras esperaba a C**: al despertar, los 1,5 s de la traba quedaron anotados como
  «esperé a C» (`espera más larga 1020 ms` en el registro de C) y C subió su retraso de más.

### 101.2 Los arreglos (`lockstep.mjs`)

1. **Quien va atrás no vota «holgura de sobra».** Cada informe lleva ahora tres **banderas**: 1 = rato dudoso (como
   antes), 2 = «sé ponerme al día solo» (el runtime puede correr cuadros seguidos y la pestaña se ve: `puedoPrisa`), 4 =
   «voy atrás / me estoy poniendo al día» (corre la ráfaga, `alDiaHasta`, o voy más de `UMBRAL_PRISA` = 3 cuadros atrás de
   la mayoría: `atrasDeLaMitad`). Si voy atrás, mi rato es dudoso: mis holguras de los demás no cuentan para que bajen su
   retraso. Con eso B ya no hace bajar a C.
2. **Al que va atrás y se pone al día solo no se lo espera** (la sincronía, `calcularDeuda`): antes, desde que iba menos
   de 20 cuadros atrás, los demás se frenaban por él aunque él ya corría para alcanzarlos. La sala iba más lenta, y al
   que se frenaba le llegaba tarde lo de los demás y subía su retraso (el 7 de A). Al que va atrás y **no puede**
   ponerse al día (pestaña escondida, `?alDia=0`) sí se lo espera, como antes. Y como siempre, no por uno que esperó en
   su rato.
3. **La traba propia mientras se espera** (`trabaPropia`, `?trabaPropia=0` = como antes): mientras espero, `revisar`
   corre cada `REVISAR_MS` = 40 ms. Un hueco de más de `TIRON_MS` = 100 ms entre dos vueltas es esta pestaña trabada
   (`congeladoEn`). Ese rato no se le carga al que faltaba, no cuenta para el margen de pausarlo o cortarlo (al
   despertar, sus mensajes todavía están en la cola: antes, una pestaña que despertaba de 1,2 s podía cortar a alguien
   que no había hecho nada) y cuenta como un tirón mío (`tironPropio`: me pongo al día). `estado()` dice cuánto
   (`msCongelado`).
4. **«bajo mi retraso a N (…)»** en el registro, con cuántos lo votaron y la holgura menor: la próxima vez se ve.

`estado()` dice además `atrasados` (los que, según su último informe, van atrás): lo usa el banco.

**Trampa: un arreglo que rompía la vuelta.** Primero `pedirPrisa` (ponerse al día porque los informes dicen que voy
atrás) también marcaba `alDiaHasta`, como `tironPropio`. Con una PC justa eso se repite cada segundo mientras voy atrás,
y como el pausado pide volver recién cuando su ráfaga terminó, **B no volvía nunca a manejar**: en `prueba-relevo` quedó
pausado toda la carrera y a los 20 s la pausa pasó a corte (✗ en «B vuelve a manejar» y en la traba de 3 s). Los bancos
no lo vieron: ahí la ráfaga pedida (n × 10 ms + 200) duraba menos que el medio segundo entre dos pedidos y quedaban
huecos para pedir volver; en el juego (16,7 ms por cuadro, hasta 120 cuadros) no quedan. Lo saqué (que voy atrás ya lo
dicen mis informes por la medida, `atrasDeLaMitad`, sin `alDiaHasta`) y el banco tiene ahora la parte 18, que lo ve.

**Lo que probé y saqué:** una corrección más, «para BAJAR mi retraso, contar la holgura sin lo que voy adelante» (si
la sincronía me va a frenar, esa holgura se acaba). Era razonable, pero ningún caso del banco la mostraba: en una sala
de dos, la PC más lenta queda relevada y nadie se frena por ella; y el caso de las corridas ya lo resuelve el arreglo 1.
Sin una prueba que la distinga, no entra.

### 101.3 El banco `relevo` §11

La comprobación decía «Carla junta más ratos de *voy atrás* que Beto». Con la PC cargada, las consolas falsas van todas
a tirones y los «voy atrás» de las dos salían 0 y 0. Pero lo que importa es la **cuenta que usa la sala** para elegir la
autoridad de la carrera siguiente (`ratosMalos`: ratos malos + «voy atrás» + la ida y vuelta, un rato por cada 10 ms).
Esa función ahora se exporta de `sala-carrera.mjs`, la sala la usa igual que antes, y el banco compara con ella:

| Cómo corrió | Carla | Beto |
|---|---|---|
| Con `lockstep` al lado | 7 (malas 1, atrás 0, 63 ms) | 3 (malas 2, atrás 0, 9 ms) |
| Con 5 bancos a la vez | 16 (malas 2, atrás 7, 70 ms) | 3 (malas 2, atrás 0, 10 ms) |

Antes, la primera fila era un ✗.

### 101.4 Las partes nuevas del banco `relevo` (38 → 44)

- **§16**: a Carla no le sale nada 300 ms (Ana y Beto la esperan) y en ese rato **Ana se traba 1,2 s** (el banco le
  adelanta el reloj: `saltos` de `crearSala`). Ana es la que decide los cortes de Carla y su margen es 1 s. Ahora: nadie
  cortado, Ana le carga a Carla 308 ms (Beto 344) y anota 1193 ms como traba suya. Con `trabaPropia: false`: Ana le carga
  1324 ms y **corta a Carla** (que queda fuera de la carrera).
- **§17**: en una sala de dos, Carla se traba 600 ms (la pausan) y se pone al día **despacio** (gana 2 ms por cuadro de
  10, `prisaPorCuadro`: 1,2 veces, como B en `prueba-relevo`). Ahora: Ana la ve «atrás» 110 veces (cada 20 ms) y se
  frena 0 cuadros; con la regla vieja (puesta a mano para comparar), 7. Carla termina 0,5 cuadros atrás. Es de dos
  porque con tres y uno a la par, Ana no se frenaba por uno solo (§99, C5).
- **§18** (la trampa de 101.2): a Carla se le traba la pestaña 1 s y casi no puede ponerse al día (0,2 ms por cuadro):
  igual pide volver a los 3 s de la pausa, maneja otra vez y nadie la corta. Con el arreglo malo puesto a mano: no vuelve
  nunca y la pausa pasa a corte (cuadro 1165).

Los bancos que usan el lockstep o la sala, corridos los cinco juntos (la PC cargada): `relevo` 43 (antes de §18), `lockstep` 50,
`sala-carrera` 101, `sala-playlist` 37, `vr-sala` 58.

### 101.5 Con el juego

Con los arreglos (sin el de la trampa):

| Prueba | Resultado |
|---|---|
| `prueba-relevo` (una traba de 1,5 s y una de 3 s) | 10 / 10: A 6, B 8, C 9 de retraso («C paga su conexión» ✓) |
| `prueba-relevo --trabas=8`, corrida 1 | 11 / 11: A esperó 34, 46, 46, 51, 77, 77, 154, 322 ms (B de retraso 7) |
| `prueba-relevo --trabas=8`, corrida 2 | 11 / 11: A esperó 297 … 322 ms (B de retraso 3) |
| `prueba-sincro --directa` | 13 / 13 |
| `prueba-sala --rapida` | 43 / 43 |
| Todo lo que va sin el juego (`correr-todo --sin-juego`) | 93 / 93: los 42 bancos juntos (`relevo` 44 / 44 con la PC más cargada), el sitio 28, `subir-r2` 23 |

En 16 trabas ninguna espera pasó de 322 ms (antes, 1,4 y 2,9 s). Lo que sigue variando es la pausa misma: A espera
hasta que se le acaban los botones de B que ya tiene (su retraso, 3 a 7 cuadros = 50 a 117 ms) más 150 ms de silencio
(`PAUSA_MS`) más la respuesta de C por su red mala. Con B de retraso 7 casi no se nota; con 3, ~300 ms. Bajar eso
pediría pausar antes de 150 ms, y entonces se pausaría a quien solo perdió un paquete: lo dejé así.

### 101.6 Lo que queda

- En `prueba-relevo`, con tres juegos en una PC, B sigue sin alcanzar a ponerse al día entre trabas (su PC corre la
  ráfaga a ~1,2 veces): es de la prueba, no de la red. En una PC sola la ráfaga corre a ~2 veces.
- De M25: Intenso e Imposible en 200cc, la prueba de conexión en el vestíbulo (reglas de Firebase, las publica el dueño)
  y el programa final a R2 (cuando el dueño diga).

## 2026-10-24 · §102 Listo para el PR: `main` juntado en la rama del sitio, el programa final probado y la PC justa que no alcanza a ponerse al día

El dueño pidió: «prepara todo para hacer PR en la paginita Pro, entiendo que tienes que compilar para R2 también».
Después pidió que el PR lo abriera la otra sesión (la de la nube, que tiene GitHub) y dio permiso para subir la rama
(«doy permiso»). Subir a R2, el Worker y las reglas de Firebase siguen siendo del dueño (`docs/publicar.md`).

### 102.1 `main` juntado en la rama del sitio

La rama `claude/loving-planck-9k2yam` iba 38 commits adelante y **171 atrás** de `main` (otras sesiones siguieron con
el sitio: Salón, pool, pacman, Halloween…). Para que el PR se pueda juntar sin conflictos, se juntó `main` en la rama
(commit `06aea0a`). Los conflictos eran casi todos **listas que crecieron de los dos lados** (cada lado agregó su juego
al final de la misma lista): quedaron las dos cosas.

| Archivo | Qué chocaba | Cómo quedó |
|---|---|---|
| `colabtex/package.json` | la lista de pruebas de `test:juegos` | las de `main` + `mkw.test.cjs` y `mkw-worker.test.cjs` |
| `monedas.js`, `salon-datos.js`, `reglas-ejemplos.js`, `reglas-ilustraciones.js`, `motor.js` | una entrada por juego | todas (las de `main` y la de `mkw`) |
| `firebase/database.rules.json` | la lista de juegos y de logros | `'mkw'` en las dos, con lo nuevo de `main` |
| `juegos-main.js` | la lista de juegos, íconos, rutas, ocultos, `PAUSA_FIN`, novedades | todo junto (también el import de Halloween de `main`) |
| `juegos.html` y los archivos sellados | los sellos de versión (`?v=…`) | los de `main` (se vuelven a sellar al publicar) |

Después: `juegos-app.js` rearmado con esbuild (el paquete de `juegos-main.js`) y `controles-datos.js` regenerado
(`build-controles.js`). **Trampa:** la regla nueva del Salón (de `main`) pide que cada juego que no es de celular diga
qué pide con «teclado» o «teclado y ratón». Mario Kart decía «teclado o mando» y fallaba `salon.test`. Se agregó la
marca `@controles: teclado` en la cabecera de `web/navegador/controles.mjs` (de ahí la lee `build-controles.js`) y la
prueba propia `mkw.test.cjs` ahora espera `"pide":"teclado"`. El mando sigue funcionando igual: la marca solo dice qué
se anuncia en el Salón.

Las pruebas del sitio (`node --test` de `colabtex/tests`) pasan todas salvo una de Worms que ya fallaba en `main` en
Windows (una ruta con `\`). La rama se subió (`git push`, con el permiso del dueño) y el pedido del PR se le mandó a la
sesión de la nube, con el texto del PR armado aquí. Esta sesión no puede ver si lo abrió: se ve en esa sesión.

### 102.2 El programa final

```bash
python herramientas/compilar-web.py --modo navegador --final --carpeta build/web-final
MKW_BUILD=build/web-final/navegador node web/navegador/guion.mjs "<una carrera>" --semilla   # 3 veces, copas distintas
MKW_BUILD=build/web-final/navegador node herramientas/correr-todo.mjs
```

- `mkw.wasm` 121,7 MB, `mkw.wasm.br` 15,7 MB (el navegador baja el `.br`).
- Las semillas rehechas con el programa final: `pipelines.bin` con 729 pipelines (las formas de dibujar que la tarjeta
  de video arma una vez) y `bloques.json` con 483 bloques del disco vistos en las 3 carreras.
- La planilla entera contra el programa final: **623 de 625** (`build/web/datos/todo/20261024-1019`). Las dos fallas,
  en 102.3 y 102.4.

### 102.3 La largada: la prueba esperaba el comportamiento de antes de §99

`prueba-sincro --directa --traba-largada=6000` traba a A 6 s en el cuadro ~50. La comprobación «B avisó que la espera
porque su navegador todavía arma la pista» venía de §93, cuando B **esperaba** a A hasta 15 s. Desde §99 (C1, el relevo
rápido) B ya no espera: a los ~150 ms **pausa** a A (su kart sigue con el botón calculado) y A vuelve a manejar cuando
despierta y se pone al día. En la corrida: B esperó a lo más 196 ms, pausó a A en el cuadro 60 y A volvió a manejar en el
658. Eso es lo que se quería; la prueba estaba vieja. Ahora comprueba eso (B esperó menos de 1 s, la pausó y A volvió;
espera la vuelta hasta 20 s más) y el aviso viejo solo con `--extra=&relevoRapido=0`.

### 102.4 La PC justa que no alcanza a ponerse al día (arreglo en `lockstep.mjs`)

`prueba-sincro --sala` falló en «el kart de A avanzó con lo que tocó A» (1,042 vueltas, se pedía más de 1,05). Esa
comprobación es floja (102.5), pero mirando el registro de A apareció algo de verdad:

- A corría a 60 cuadros por segundo con **15 ms de trabajo por cuadro** (de 16,7 posibles): sin margen. Algunos cuadros
  tardaban más y A quedaba atrás de a poco.
- A pedía ponerse al día cada segundo («voy 7,5 cuadros atrás de la mayoría: me pongo al día 5 cuadros»), pero **no le
  salía**: sin margen, la ráfaga no corre más rápido que el reloj.
- Desde §101, B no se frena por quien dice «voy atrás» y «sé ponerme al día» (la idea: ese se alcanza solo). Como A lo
  decía, B no se frenó nunca (1 cuadro en toda la carrera) y A llegó a ir **9,5 cuadros atrás**.
- Ir atrás se paga con retraso: lo de A le llega a B tarde, así que A subió su retraso hasta **11-12 cuadros** (~190 ms
  entre que A aprieta y su kart responde). Antes de §101, B se frenaba un poco por A y el retraso de A quedaba en ~8.

**El arreglo:** «sé ponerme al día» (la bandera 2 del informe) ahora vale solo si **de verdad** lo estoy logrando. En
cada rato que voy atrás, la consola cuenta cuántos cuadros corrió y cuántos le tocaban por el tiempo en que corrió (sin
lo que estuvo parada: esperas, frenos y tirones). Pasados 3 ratos atrás (`RATOS_PRUEBA`), si no ganó al menos un 4 %
(`GANA_MIN`), deja de decirlo y anota «voy atrás y no alcanzo a ponerme al día (…): que me esperen». Entonces los demás
se frenan por ella como antes de §101 (la sincronía de §80b). Quien sí se pone al día (B en `prueba-relevo`, a ~1,2
veces) lo sigue diciendo y nadie se frena por él. `?alcance=0` = como en §101. `estado().sinAlcance` = cuántos ratos no
alcanzó.

Como en un control con dos lazos: el lazo rápido (cada uno corrige su propio atraso con la ráfaga) solo sirve si tiene
margen de actuador; si está saturado, tiene que actuar el lazo lento (los demás bajan un poco su ritmo). Antes de §102 el
lazo rápido decía «yo me encargo» aunque estuviera saturado.

**El banco `relevo` §19** (44 → 46): Carla con una PC justa: una traba de 60 ms en el cuadro 299 la deja 6 cuadros atrás
y después va un 2 % más lenta que el reloj, con una ráfaga que gana a lo más 1 %. Las dos con retraso fijo 10, para que
no se meta el relevo (en el juego, el retraso de 12 de A tapaba el atraso).

| Regla | Ana se frenó | Carla fue a lo más (desde el cuadro 700) |
|---|---|---|
| §102 | 45 cuadros | **4** cuadros atrás |
| §101 (`alcanceReal: false`) | 8 cuadros | 22 cuadros atrás |

Trampas del banco: con Carla un 2 % lenta y sin traba, Ana ya la frenaba antes de que pasara de 3 cuadros (nunca «iba
atrás»: no se veía nada); con Carla un 6 % lenta o con trabas de 60 ms seguidas, Ana la relevaba (§80: el lento no frena
a los demás), que es lo correcto para una PC lenta de verdad. El caso de A es el de en medio: va a 60, pero pierde
cuadros sueltos.

Además, el banco `relevo` ya tarda ~5 min (sus 19 partes son carreras de verdad a 100 cuadros por segundo) y
`banco/correr.mjs` cortaba a los 5: ahora espera hasta 8.

### 102.5 «El kart de A avanzó»

A solo aprieta el acelerador y choca en la primera curva: cuánto avanza depende de cómo rebota (1,042 a 1,25 vueltas en
las corridas). Ahora se mide lo que avanzó **desde donde estaba al apretar** el acelerador (más de 0,02 vueltas, ~20 m) y
que haya pasado la largada.

### 102.6 Con el juego (el programa final)

Las cuatro pruebas de la red, otra vez con el programa final (`correr-todo --solo sincro-sala,sincro-largada,sincro-directa,relevo`,
`build/web/datos/todo/20261024-1202`): **49 de 49**.

| Prueba | Resultado |
|---|---|
| `sincro-sala` (dos pestañas en la sala falsa del sitio) | 11 / 11: el kart de A, 0,979 → 1,296 vueltas |
| `sincro-directa` | 13 / 13: retraso A 4, B 2 |
| `sincro-largada` (A trabada 6 s) | 15 / 15: B esperó a lo más 200 ms, pausó a A en el cuadro 60 y A volvió |
| `prueba-relevo` (C con red mala) | 10 / 10: retraso A 2, B 4, C 12 («C paga su conexión») |
| Bancos `relevo` y `lockstep` | 46 / 46 y 50 / 50 |

**Lo que se vio y no se arregló:** en esta `sincro-sala`, A volvió a terminar con retraso 12. No fue lo de 102.4: A le
pasó la autoridad a B porque iba atrasada («me esperaban a mí») y quien recibe la autoridad **releva** a la que se la
dio (§80). Al relevado nadie lo espera (el lento no frena a los demás, a propósito), y en esa corrida la PC de A tuvo un
rato a 53-57 cuadros por segundo: llegó a ir 68 cuadros atrás. Pasado el retraso máximo (12) ya no vuelve a lo directo
en toda la carrera: su kart va con sus botones, pero tarde. Queda anotado en el PLAN (M25).

La planilla entera con el programa final y el arreglo (`MKW_BUILD=build/web-final/navegador node herramientas/correr-todo.mjs`,
`build/web/datos/todo/20261024-1210`): **624 de 625** en 35 pruebas. La que falló fue de `prueba-sala`: al terminar la
carrera 2, el VR de A se calculó con A «cortada» (la sala la cortó en el cuadro 965 de esa carrera) y por eso no daba lo
que esperaba la prueba. Se corrió `sala` dos veces más (`--solo sala --repetir 2`, `20261024-1318`): 44 de 45 (otra cosa:
el descanso de 30 s se vio a los 32,5 s, la prueba mide desde que ella vio el fin y el reloj de la página estaba bien,
30000 ms) y **45 de 45**. Queda como **intermitente vigilada**: desde ahora `prueba-sala` deja el registro de la red de
cada pestaña (`red-A.txt`, `red-B.txt` en su carpeta de datos) y acepta `--extra=&…`, así la próxima vez se ve por qué
se cortó.

### 102.7 Lo que queda (del dueño)

1. Subir lo privado a R2 (`docs/publicar.md` paso 2, con `MKW_BUILD=build/web-final/navegador`). La lista ya está armada (`node herramientas/subir-r2.mjs`, solo revisar: nada salió de este PC): **7.324 archivos, 5,00 GB**, versión `1da4225a723546b3`, programa `f623e34029f32c29`; los más grandes son los videos del final y del título (220, 220, 185, 185 y 148 MB).
2. Pegar el Worker nuevo (paso 3) y publicar las reglas de Firebase (paso 5).
3. Juntar el PR (lo abre la sesión de la nube) y recién después poner `juegos/mkw/privado.json` (paso 4).

## 2026-10-24 · §103 «🛰 Todo por Cloudflare»: un modo de conexión excepcional, apagado por omisión

El dueño preguntó si Cloudflare podía hacer de servidor de la conexión. Se le explicaron dos caminos: un **repetidor**
(el TURN de Cloudflare Realtime, que el Worker de amigos ya entrega) o un **servidor de verdad** (un Durable Object por
sala, con más retraso para Chile y con costo por mensaje). Eligió el repetidor: «ok la opción 1, recuerda que es una
opción adicional no habilitada por defecto, tal como en el bt3 que es excepcional».

### 103.1 Qué hace

| | Directa (por omisión) | 🛰 Todo por Cloudflare |
|---|---|---|
| Quién lo elige | — | el anfitrión, en «✎ Cambiar» del vestíbulo (fila «Conexión»), solo antes de empezar |
| Cómo van los paquetes | directo de navegador a navegador; el repetidor solo si nada directo anda (§99) | **todos** por el repetidor de Cloudflare, aunque lo directo funcione |
| Para qué | lo normal: el ping más bajo | redes difíciles o carreras que se cortan (universidad, empresa, datos móviles, un router que pierde el WebRTC) |

Es como en BT3 (la fila «Conexión: Directa / 🛰 Relevo de Cloudflare» de su sala, «último recurso» del anfitrión,
nunca automático: `bt3.js`, `bt3-marco.js`). El titular del
vestíbulo dice «· 🛰 Cloudflare» para que todos lo vean, y la prueba de conexión de §100 muestra 🛰 al lado de cada
piloto.

### 103.2 Cómo funciona

1. **El sitio** (`colabtex/src/juegos/motor.js`, `redMkw`): la jugada `{t:"ajuste", k:"relevo", v:true}` vale solo del
   anfitrión y en el vestíbulo; `est.relevo` es `false` por omisión. `mkw.js`: la fila «Conexión» (`MKW_CONEXION`,
   `AYUDA_CONEXION`), el titular y la dirección del marco con `&conexion=cloudflare` (sin el ajuste, nada nuevo en la
   dirección).
2. **La página del juego** (`mkw.mjs`): con `conexion=cloudflare` arma su malla con `soloRelevo` y le **pide** al sitio
   las credenciales (`{tipo:'turn'}`); el sitio se las pide al Worker (`relevoBt3()`, el mismo `/turn` de BT3, con el
   token de quien juega) y contesta `{tipo:'turn', iceServers}`, vacío si el Worker no tiene TURN. Antes el sitio mandaba
   las credenciales recién cuando la sala del juego existía (después de cargar): para este modo no servía, porque la
   malla ya estaba conectando.
3. **La malla** (`malla.mjs`, opción `soloRelevo`): tres estados, `malla.modo()`:
   - `esperando`: no conecta a nadie; lo que llega del buzón (las ofertas de los otros y sus candidatos) se guarda;
   - `relevo`: llegaron credenciales con un `turn:`/`turns:` → cada conexión nueva va con `iceTransportPolicy: 'relay'`
     (WebRTC solo junta candidatos del repetidor) y se atiende lo guardado, en orden;
   - `normal`: llegaron vacías (`alRelevo('sin')`) o no llegaron en 8 s (`'tarde'`): directo, como siempre.

### 103.3 El repetidor de mentira (para probarlo sin internet)

`herramientas/turn-local.mjs`: un servidor TURN propio, escrito desde los RFC 5766/8656 (nada copiado), solo UDP e IPv4,
en 127.0.0.1. Hace lo que hace el de Cloudflare: pide la clave (el 401 con reino y nonce, y después la firma HMAC-SHA1 de
cada mensaje, MESSAGE-INTEGRITY), da una «asignación» (un puerto UDP propio para cada navegador), y reenvía lo que cada
uno manda (Send o ChannelData) al puerto del otro y de vuelta (Data o ChannelData), solo hacia quien tiene permiso
(CreatePermission/ChannelBind). Cuenta asignaciones, reenvíos y bytes. Lo sirve el banco en `/turn` (`banco/servir.cjs`,
igual que el `/turn` del Worker) y lo prende `prueba-sincro --cloudflare` en su propio proceso. Chrome lo acepta en
127.0.0.1.

### 103.4 Pruebas

| Prueba | Resultado |
|---|---|
| Banco `red` (28 → 35) | ✓ sin credenciales todavía no conecta; ✓ con ellas los dos extremos son «relay» (1 ms); ✓ 200 paquetes llegan y el repetidor pasó 110 KB (82 KB de datos, dos tramos); ✓ credenciales vacías → directo y avisa «sin»; ✓ no llegan → directo a los 1,2 s («tarde»); ✓ **apagado: directo aunque tenga el repetidor** |
| `prueba-sincro --directa --cloudflare` (con el programa final) | 15 / 15: una carrera entera solo por el repetidor (A y B con los dos extremos «relay»), las huellas iguales (la misma carrera), retraso A 4, B 2, el repetidor pasó 1 MB |
| Sitio `mkw.test.cjs` (21 → 23) | ✓ apagado por omisión, solo el anfitrión, solo en el vestíbulo, solo `true`; ✓ la dirección lleva `conexion=cloudflare` solo prendido; ✓ el marco pide y el sitio contesta |
| Sitio `npm run test:juegos` | 1113 / 1114 (la que falla es la de las rutas de Windows de Circuit Breakers, que ya fallaba antes) |

**Trampa del banco:** «200 paquetes = 400 reenvíos» no se cumple: WebRTC (SCTP) junta varios mensajes chicos en un
mismo paquete UDP y salieron 310. Se cuentan los bytes, que no se juntan.

**No probado de punta a punta:** el sitio con el Worker de verdad pidiendo credenciales reales de Cloudflare (eso
necesita `TURN_ID`/`TURN_CLAVE` y sale a internet). El camino `relevoBt3()` → `/turn` es el mismo que ya usa BT3.

### 103.5 Lo que hace el dueño

Nada nuevo si el Worker ya tiene `TURN_ID` y `TURN_CLAVE` (las de BT3). Si no las tiene, el modo igual se puede
prender, pero cada marco recibe credenciales vacías y va directo (el registro dice «el repetidor de Cloudflare no está
disponible»). Costo: el plan gratis de Cloudflare Realtime trae 1.000 GB al mes; una carrera de 2 pilotos pasó ~1 MB.

### 103.6 Una pregunta abierta

Con el modo **apagado**, la sala igual le pide al Worker las credenciales y WebRTC usa el repetidor **solo si nada
directo funciona** (lo decidió §99, H1: con 66 pares nadie adivina cuál falla). En BT3 el repetidor no se usa nunca si el
anfitrión no lo prende. Queda para que el dueño decida si Mario Kart sigue así o se apaga del todo como en BT3.

### 103.7 La respuesta del dueño: «como en el bt3» (§103b)

El dueño eligió que sea como en BT3: **sin el modo, no hay repetidor, ni de reserva**. Lo que se quitó:

| Dónde | Antes (§99) | Ahora (§103b) |
|---|---|---|
| El sitio (`colabtex/src/juegos/mkw.js`, cuando la sala del juego existe) | le pedía al Worker las credenciales (`relevoBt3()`) y se las mandaba al marco, siempre | nada: el único pedido a `/turn` es el que hace el marco en el modo «🛰 Todo por Cloudflare» (`{tipo:'turn'}`) |
| El juego (`mkw.mjs`, los mensajes del sitio) | sumaba ese TURN a cada conexión nueva (`malla.ponerIce`): ICE lo usaba si nada directo andaba | no lo escucha: un sitio viejo (en la caché de alguien) que lo siga mandando no cambia nada |
| La ayuda de «Directa» en el vestíbulo | — | dice «Si a alguien no le conecta, prueben «🛰 Todo por Cloudflare»», como el «último recurso» de BT3 |

**Qué significa para quien juega:** dos PC detrás de redes difíciles (las que no dejan pasar una conexión directa:
NAT simétrico, algunas universidades o empresas, algunos datos móviles) ya no se conectan solas por Cloudflare. El
anfitrión tiene que prender el modo y volver a empezar. A cambio, ningún paquete pasa por Cloudflare sin que el
anfitrión lo haya elegido.

**Pruebas:** sitio `mkw.test.cjs` 23/23 (la prueba de §103 ahora además exige que el sitio llame a `/turn` una sola vez,
la del marco; que no mande el TURN por su cuenta; y que el juego use `ponerIce` solo dentro del modo; la de M22, que
pedía lo de §99, se dio vuelta). Con el juego, con el programa final: banco `red` 35/35, `prueba-sincro --directa
--cloudflare` 15/15 (los dos extremos «relay», 962 KB por el repetidor) y `prueba-sincro --sala` 11/11 (la sala del sitio
de mentira, directo y sin repetidor: retraso A 3, B 2).

## 2026-10-24 · §104 Menos llamadas al Worker: los pedazos del disco de a muchos, una sola pregunta previa y los videos con histéresis

El dueño: «optimiza las llamadas de descarga para el juego, recuerda que cloudflare son 100k calls por dia». El plan
gratis de Workers cuenta **llamadas**, no megas, y la cuenta es una sola para todo el sitio (BT3 también).

### 104.1 Cuánto se gastaba y en qué (medido, no estimado)

Para medir sin adivinar, el Worker local (`herramientas/worker-local.mjs`, que corre el archivo `worker.js` de verdad)
anota cada llamada (hora, método, ruta, bytes) y `herramientas/medir-sitio.mjs` las separa por visita, por tramo y por
tipo (`<base>-v<n>-pedidos.json`). La página de Juegos de verdad, el juego en su marco y el programa final:

| Visita (hasta la primera carrera) | Llamadas | Preguntas previas (CORS) | Pedazos del disco | Otros |
|---|---|---|---|---|
| 1.ª (navegador vacío) | **1.392** | 696 | 661 (180 MB) | 35 |
| 2.ª (con caché) | 38 | 18 | 17 | 3 |

Dos cosas saltaban:
1. **La mitad eran preguntas previas.** Se probó qué hace Chrome (una página de mentira con un «Worker» que cuenta los
   `OPTIONS`): con `cache: 'no-store'` en el pedido, Chrome **no usa** la respuesta guardada de la pregunta previa y
   vuelve a preguntar antes de cada pedido (5 pedidos = 5 preguntas). Sin esa opción, una pregunta y 4 sin preguntar. Y
   con POST a una misma dirección, una sola pregunta para todo (Chrome la recuerda 2 horas). El `Range` solo no hace
   preguntar; lo que obliga es el token (`Authorization`).
2. **Los pedazos iban de a uno**: 541 de 661 eran de un solo bloque de 256 KB, a 349 archivos distintos.

### 104.2 Lo que se hizo

1. **El lote** (`web/navegador/lote.mjs`, nuevo): junta los pedazos en un `POST <origen>/lote` con el cuerpo
   `{"p": [[ruta, inicio, fin], …]}`; la respuesta trae los pedazos pegados en ese orden, sin separadores (la página
   sabe cuánto mide cada uno) y cada uno se entrega apenas termina de llegar. Lo urgente (el juego esperando) sale en
   seguida y va primero; lo demás espera 8 ms para juntarse; como mucho 4 llamadas a la vez (+2 para lo urgente), así
   que con carga los lotes crecen solos. Topes: 12 pedazos y 16 MB por lote (el Worker acepta 32 MB). La primera
   llamada sale sola (si salen varias juntas antes de tener contestada la pregunta previa, el navegador pregunta por
   cada una). Si el Worker no conoce el lote (404/405/400, o el navegador no lo deja pasar en las 2 primeras), se apaga
   y todo va de a uno como antes; si un lote se corta a medias, lo que faltó se pide de a uno.
2. **El disco** (`disco.mjs`, opción `lotes`): cada tramo va al cartero; las lecturas del juego, urgentes; la fila
   baja (la semilla de bloques) sale de a ráfagas de 12 trabajos (un lote); un archivo entero con su tamaño (los
   chicos del arranque) también va por lote. `?lote=0` = de a uno, como antes.
3. **Los videos con histéresis**: los fondos de los menús son videos THP que se leen en orden mientras se reproducen,
   y la lectura seguida pedía UN bloque nuevo cada vez que avanzaba un bloque (`cup_select.thp`: 115 llamadas para
   33 MB). Ahora, con lotes, mientras queden 16 bloques (4 MB) por delante no pide nada y, si quedan menos, rellena
   hasta 32 bloques (8 MB) de una vez.
4. **El Worker** (`juegos/bt3/fuente/disco/worker.js`): `POST /mkw/lote` (solo amigos, como todo; nada del programa
   ni del manifiesto; nada de `..`; hasta 12 pedazos y 32 MB). Cada pedazo sale del caché de Cloudflare o de R2 (y se
   deja en el caché con la MISMA llave que un pedido Range de esos bytes), en orden y con 2 de adelanto (como mucho 3
   operaciones esperando: el límite son 6), sin copiarlo (`tee` + `pipeTo`). Los paquetes de imágenes del selector de
   pistas llevan su huella en el nombre (`clips-000.3b1e268f.pak`): ahora van guardables para siempre (antes, `no-store`:
   se bajaban otra vez en cada visita).
5. **Las semillas por la caché del disco**: `pipelines.bin` y `bloques.json` pasan por `disco.entero` (Cache Storage con
   la versión de los archivos): en la 2.ª visita no llaman al Worker.
6. `servidor.mjs` (las pruebas, mismo origen) también contesta `POST /lote`, así todas las pruebas del juego usan el
   mismo camino; el Worker local pasa el cuerpo de los POST; la precarga de la sala (§98) pide su semilla como «no
   urgente» y de a 24 trabajos (el cartero los junta de a 12).

### 104.3 Resultado

| | Antes | Con el lote | + histéresis |
|---|---|---|---|
| 1.ª visita, hasta la primera carrera | 1.392 | 330 | **123** (−91 %) |
| …de ellas, preguntas previas | 696 | 7 | 7 |
| 2.ª visita | 38 | 21 | **16** (−58 %) |
| Hasta la carrera | 69,9 s | 68,5 s | 68,9 s (igual) |

Con 100.000 al día: unas **800 primeras visitas** o **6.000 segundas** (antes ~70 y ~2.600).

Lo que queda (`<base>-v<n>-lotes.json`, la historia de cada pedazo): en la 1.ª visita, 64 de los 110 lotes llevan un
solo pedazo. Son lecturas del juego en cadena: lee un archivo entero antes de abrir el siguiente, así que no hay con
qué juntarlas (y esperar más para juntar haría más lenta la carga). En la 2.ª visita son los karts y las voces de los
CPU, que salen al azar en cada carrera (18 pedazos chicos en 15 lotes, 4 MB).

**La sala** (`node herramientas/prueba-experiencia.mjs`: tres navegadores —Uno, Dos e Intruso—, un jugador, la sala con
la precarga y una carrera): **326 llamadas** (31 preguntas previas, 261 lotes) con el Worker nuevo. Con el Worker de
antes (sin `/lote`) la misma página lo nota, pide de a uno y la sala anda igual (23/23): **2.189** llamadas (1.087
preguntas previas). Eso prueba también, de punta a punta, el camino de un Worker viejo.

### 104.4 Pruebas

| Prueba | Resultado |
|---|---|
| Banco `lote` (nuevo) | 20 / 20: exacto aunque la respuesta llegue en trozos al azar; 30 pedazos = 3 llamadas; la primera sola; urgente primero y en seguida; topes; Worker viejo (404 y sin POST) y lote cortado = de a uno; un video de 16 MB leído en orden = 6 llamadas |
| Banco `disco` | 38 / 38 (sin lotes, igual que antes) |
| Sitio `mkw-worker.test.cjs` | 11 / 11 (5 nuevas: el lote exacto, solo amigos, la pregunta previa con POST; lo que rechaza; el corte si falta un pedazo; el caché de Cloudflare con la misma llave; los paquetes de imágenes guardables) |
| `prueba-navegador` (programa final) | 21 / 21 (lo de siempre con este monitor de 175 Hz) |
| `prueba-experiencia` | 23 / 23 |

**La planilla entera** (`MKW_BUILD=build/web-final/navegador node herramientas/correr-todo.mjs`, 2026-10-24 17:18):
641 bien, 6 mal. `precarga` (1): el porcentaje se miraba desde afuera cada 300 ms y la precarga ahora dura ~1 s, así
que solo se vieron 4 valores (0 → 39 → 79 → 100); la prueba ahora los anota desde adentro de la página cada 10 ms (lo
que recibe el sitio, que ve cada aviso): 37 valores, 8/8. `sala` (4, todos de una misma causa: A no avanzó en la pantalla
de personajes y la carrera 1 empezó sin su elección) y `relevo` (1): con **eFootball abierto en este PC** (otro juego
usando la tarjeta de video y el procesador); al repetirlas siguió peor (A a 6,7 cuadros/s, «Tu PC no alcanza 60
cuadros por segundo»). Repetidas con el PC libre (19:01): `relevo` 10/10 y `sala` 44/45. La que falta es otra cosa,
que ya había salido a las 12:10 (antes de §104): en la carrera 2, A se va quedando atrás (de 24 a 54 cuadros, «me pongo
al día»), B la releva desde el cuadro 282 y en el cuadro 1200 las huellas no coinciden («¡DESINCRONIZADO … carrera!»):
A se sale de la carrera y pierde el VR como cortada. Es intermitente (2 de las últimas 4 corridas enteras de `sala`) y
queda para investigar aparte.

**Trampa:** desde el `main` de §102, el sitio abre solo la **Tienda de Halloween** una vez al día a las cuentas que
entran al salón, y su ventana tapaba los botones de la sala: `prueba-experiencia` se cortaba a los 30 s de esperar un
clic. La prueba ahora deja la marca de «vista hoy» que deja el sitio (`jg.tiendaHw.visto`).

### 104.5 Lo que hace el dueño

**Volver a pegar el Worker** (`docs/publicar.md` paso 3): trae `POST /mkw/lote`. Con el de antes el juego anda igual,
pero gasta ~10 veces más llamadas.

## 2026-10-24 · §105 Mario Kart en su propio bucket de R2

El dueño, antes de subir: «mejor creamos otro bucket para no usar el mismo». Así lo de Mario Kart queda aparte de la ISO
de BT3: su propia llave de subida (que solo puede tocar ese bucket), su uso a la vista en Metrics, y se puede vaciar o
borrar sin riesgo para BT3.

**Lo que cambió:**
1. El Worker (`juegos/bt3/fuente/disco/worker.js`): Mario Kart lee de `mkwR2(env) = env.MKW || env.DISCO`. Con el enlace
   `MKW`, del bucket propio; sin él, de `DISCO`, como antes. **Las llaves no cambian** (`mkw/build/mkw.js`,
   `mkw/mkw/disco/…`): así `subir-r2.mjs` sube igual (solo cambia `R2_BUCKET`), el caché de Cloudflare guarda con las
   mismas llaves y volver atrás es quitar el enlace. BT3 (`/pieza/…`, `/indice.json`, `/subir`) sigue solo en `DISCO`.
2. El Worker local (`herramientas/worker-local.mjs`, el de `sitio-local`, `medir-sitio`, `jugar.bat` y
   `prueba-experiencia`) ahora le da a Mario Kart el enlace `MKW` (los archivos de este PC) y a `DISCO` un bucket vacío:
   lo mismo que tendrá el Cloudflare del dueño, y si algo de Mario Kart se fuera a buscar a `DISCO` fallaría a la vista.
3. `docs/publicar.md`: el paso 1 crea el bucket (`mkw-retro`, sin acceso público) y la llave solo para él; el paso 3
   agrega el enlace `MKW` en el Worker.

**Ojo con el espacio:** el plan gratis de R2 da 10 GB **por cuenta**, sumando todos los buckets: un bucket aparte no da
más espacio gratis. Mario Kart son 5,0 GB; lo que pase de 10 GB cuesta ~0,015 USD por GB al mes.

**Pruebas:**

| Prueba | Resultado |
|---|---|
| Sitio `mkw-worker.test.cjs` + `bt3-disco.test.cjs` | 19 / 19 (nueva §105: con `MKW`, los pedazos, el archivo entero, el manifiesto y el lote salen del bucket propio; lo que está solo en `DISCO` ya no se lee para Mario Kart; BT3 sigue en `DISCO`) |
| El Worker local con `MKW` (curl con el token de prueba) | manifiesto 200, lote 200, pedazo 206; `/indice.json` de BT3 404 (su bucket, vacío aquí) |
| `prueba-experiencia` (la sala entera por el Worker local, ahora con `MKW`) | 23 / 23 (330 llamadas: 31 preguntas previas, 265 lotes) |

### 105.1 La primera subida de verdad: «325 de 7324 no están bien» (y estaban bien)

El dueño subió a su bucket y `--comprobar` dijo `✗ 325 de 7324 no están bien`, todos «distinto … (0 bytes, huella …)» y
todos de texto (`mkw.js`, `mkw.wasm.br`, los `.json`, los planos `.svg`). La huella que R2 tenía guardada era la de la
lista (`115476d9b43f` = `mkw.js`): **estaban bien subidos**. Lo que fallaba era la revisión: el `fetch` de Node pide las
respuestas comprimidas (`Accept-Encoding: gzip, br`), Cloudflare comprime los tipos de texto (JavaScript, JSON, SVG,
WebAssembly) y entonces la respuesta a `HEAD` llega **sin `Content-Length`**; el script leía eso como 0 bytes. Arreglo:
`subir-r2.mjs` pide todo sin comprimir (`Accept-Encoding: identity`, una cabecera que no va firmada). El R2 falso de
`prueba-subir-r2.mjs` ahora hace lo mismo que Cloudflare (comprime el texto si el cliente acepta): con el script viejo
da 19 bien y 4 mal, con el arreglo 23/23. El Worker no se entera de nada de esto (lee R2 por su enlace, no por la API S3).

### 105.2 El Worker publicado y la dirección

El dueño pegó el Worker nuevo y agregó el enlace `MKW` → `mkw-retro`. Revisado desde aquí, sin sesión (no baja nada del
juego): `GET /mkw/manifiesto.json` → 401 «inicia sesión»; la pregunta previa de `POST /mkw/lote` → 204 con
`Access-Control-Allow-Methods: GET, HEAD, PUT, POST, OPTIONS` (el Worker viejo no tenía POST) y el lote sin sesión → 401
(el viejo contestaba 404). El enlace `MKW` solo se ve con la sesión de un amigo: la primera partida de un amigo lo
prueba. `privado.json` (→ `juegos/mkw/privado.json` del sitio) = `https://bt3-disco.rayoluxd1.workers.dev/mkw`: el sitio
lo lee recién cuando la rama se junte a `main`.

## 2026-10-25 · §106 Los mandos como en BT3 (elegir el jugador de cada mando) y la barra de descarga

Pedidos del dueño, ya con Mario Kart publicado en el sitio (PR #258): «no veo el soporte de mandos de los otros juegos»,
«en bt3 aparece el mando que uno tiene y permite seleccionar entre mandos» (con una captura del panel Controles que decía
«Ningún mando todavía») y «tienes que agregar la barra de descargas con el progreso cuando se esté descargando algo».
Hecho desde la sesión de la nube (sin el juego: todo probado en el banco y en la página real sin el programa).

### 106.1 Qué jugador es cada mando

**Antes:** los mandos iban a los puertos en el orden en que el navegador los veía. Con dos mandos, o con uno «virtual»
al lado del de verdad (Steam, DS4Windows y similares crean un mando de Xbox de mentira), el jugador 1 podía quedar con
el equivocado y no había cómo cambiarlo. BT3 sí lo deja elegir (la ventana de controles del port: qué mando usa cada
jugador).

**Ahora** (`controles.mjs`):
- `clavesMandos(lista)`: cada mando se reconoce por su nombre (`g.id`) y, si hay dos iguales, por su orden (`…#2`). El
  índice solo no sirve (cambia al desconectar y volver a conectar).
- `repartirPuertos(claves, elegidos)`: primero los mandos con un jugador elegido, después los demás en el primer puerto
  libre. Se reparte de nuevo solo cuando cambia qué mandos hay o lo elegido: nadie salta de puerto solo.
- `controles.elegirPuerto(clave, puerto)`: elegir un jugador que ya tenía otro mando los **cambia de lugar**. Se guarda
  en el navegador (`mkw.mandos` → `puertos`), así se recuerda al desconectar el mando y al recargar.
- Si el navegador no deja leer mandos (un marco sin el permiso `gamepad`: `getGamepads()` lanza un error), se anota
  `estado.bloqueados` y el teclado sigue andando. Antes ese error habría parado el bucle de los controles entero.

En la página: cada tarjeta del panel Controles → Mandos tiene **«Jugador 1–4»** y las tarjetas van en orden de
jugador; la pastilla del mando de la barra dice qué jugador es cada uno («🎮 J1 DualSense · J2 Xbox 360») y **un clic
la abre en Controles** (como la de BT3 abre sus ajustes). Sin mandos, el panel explica qué hacer: Chrome no le muestra
un mando a la página hasta que se aprieta un botón con la página a la vista (es por privacidad); dentro del marco de
Juegos a veces hace falta un clic en el juego antes.

### 106.2 La ayuda de la tarjeta de inicio con los botones del mando

Como en los otros juegos del sitio: con un mando conectado, la línea de teclado de la tarjeta de inicio
(`.teclas`: «K acelerar · J frenar…») se cambia por los botones del mando en la letra de su familia (✕ ○ □ △ en
PlayStation, A B X Y en Xbox). Es una línea en `mando-sitio.mjs`: `zonas: [{ sel: '.teclas' }]` para el `mando.js` del
sitio, que esconde la ayuda y pone al lado la del mando. Solo dentro del sitio (sin el `mando.js` de Juegos no cambia
nada).

### 106.3 La barra de descarga (`descargas.mjs`)

**Antes:** al abrir, la cortina tenía una barra que iba y venía, sin decir cuánto faltaba (la que se llena con % era solo
la de la sala, §99), y durante el juego no se veía nada cuando el juego esperaba un pedazo del disco.

**Ahora:** `crearDescargas()` envuelve el `fetch` de la página (encima del de `privado.mjs`, que pone el token): a cada
respuesta del Worker le lee una **copia** (`clone()`) solo para contar los bytes mientras llegan; el juego recibe la
original intacta.
- **De cuánto:** el lote (§104) lo dice en su cuerpo (`{"p": [[ruta, inicio, fin], …]}`), un pedido con `Range` en su
  cabecera y lo demás en `Content-Length`.
- **El programa** viaja comprimido (16,5 MB en brotli) y el navegador lo entrega descomprimido (127,6 MB): lo contado se
  divide por la proporción (7,7 la primera vez; después la medida de verdad, guardada) para hablar de lo que viaja. Se
  cuenta **solo la primera vez** que se baja cada programa (`mkw.descargas.programas`): después sale de la caché HTTP en
  un instante, y así la copia nunca toca la caché de código compilado de Chrome (§54).
- **Cuándo aparece:** si bajar algo dura más de 0,4 s, o si el juego lleva más de 0,4 s esperando una lectura del disco
  (`mkwLeeRango` avisa con `esperaJuego(±1)`): lo que llega en un instante no parpadea en pantalla. Se va sola 1,2 s
  después de terminar, con «Listo».
- **Qué dice:** «⬇ Bajando 42,1 MB de 118 MB · 9,8 MB/s» con la barra llenándose (sin total conocido, la barra va y
  viene). Si el juego espera, «⬇ Cargando…». Sobre la cortina de carga va al centro y, en la primera visita, agrega «La
  primera vez tarda más: queda guardado para la próxima».
- **Dónde:** abajo a la izquierda mientras se juega (300 px, sin `backdrop-filter`: no re-desenfoca el juego cada
  cuadro), y se repinta 4 veces por segundo, nada más. `?barraDescarga=0` = sin contar ni mostrar nada.

**Pruebas:**

| Prueba | Resultado |
|---|---|
| Banco `descargas` (nuevo, Worker de mentira con respuestas que llegan de a pedazos) | 29 / 29 |
| Banco `mandos-jugador` (nuevo, mandos de mentira: dos iguales, uno virtual, uno que vuelve, uno bloqueado) | 17 / 17 |
| Banco `mando-sitio` (+1: la ayuda de la tarjeta cambiada por los botones del mando) | 11 / 11 |
| Banco `controles` (sin cambios de comportamiento) | 47 / 47 |
| La página real sin el programa (banco, Chromium): la pastilla abre Controles con el selector; la barra aparece con una descarga larga y se va sola | sin errores |
| Sitio `mkw.test.cjs` + `mkw-worker.test.cjs` + `controles.test.cjs` | 40 / 40 |

Falta probarlo con el juego de verdad en la PC del proyecto (`prueba-navegador`, `prueba-sala`): el banco no tiene el
programa.

`banco/servir.cjs` busca ahora el `mando.js` del sitio también en `juegos/audio` al lado de `juegos/mkw` (dentro del
repo del sitio no hay `terceros/`).

## 2026-10-25 · §107 Gráficos opcionales (resolución interna, fluidez 120/180) y el medidor de fps y ping

Pedido del dueño: «opciones gráficas tipo opcionales de display ping ms, fps, antialiasing, subirle los gráficos», «fps
cap? vi que se podía como hasta 180 fps», «quizás se puede más fps y no se». Hecho desde la sesión de la nube, sin el
juego: probado en el banco y en la página sin el programa. **Falta medirlo con el juego** (abajo).

### 107.1 Qué trae el motor (y qué no)

Revisado en `runtime/include/runtime_config.h` de WiiCompiled en el commit fijado (`bd219e38`): el `[video]` del
`Config.toml` acepta, entre otras,
- `resolution_multiplier` = 0, 1, 1,5, 2, 3, 4, 6 u 8 (0 = el tamaño de la ventana): la **resolución interna**;
- `frame_interpolation_fps` = 0, 120 o 180 (un 240 guardado pasa a 180): las **imágenes intermedias**. Eso es el «hasta
  180» que vio el dueño.

**Más de 60 «de verdad» no se puede:** la física y todo el juego están hechos para 60 cuadros por segundo; correrlo más
rápido sería el juego acelerado. Lo de 120/180 son imágenes intermedias. **No hay un antialiasing aparte** en el motor
(no tiene MSAA ni FXAA): la resolución interna a 2× o más ya lo es, por supermuestreo.

### 107.2 En la página (`graficos.mjs`)

- **Avanzado → Gráficos**: «Resolución interna» (1×, 1,5×, 2×, 3×, 4×; 6× y 8× no se ofrecen, son demasiado para un
  navegador) y «Fluidez» (60, 120, 180). Se guardan en el navegador (`mkw.graficos`) y se aplican **al reiniciar el
  juego** (el motor lee el `Config.toml` una vez, al arrancar); el panel lo dice y trae «Reiniciar el juego ahora» (en
  la sala, con la nota de hacerlo entre carreras: al recargar se vuelve en la siguiente, §75).
- **Apagadas por omisión.** Con 1× y 60, `lineasVideo()` no agrega nada al `Config.toml`: el juego arranca
  exactamente igual que antes de §107. Un valor que el motor no acepta (guardado viejo, a mano) vuelve a lo de siempre.
- **Mostrar los fps / el ping**: un chip en la esquina de arriba a la izquierda (`#medidor`, en `#estadoJuego`),
  repintado una vez por segundo, solo con el juego andando: «60 fps · 📶 Ana 80 ms · Juan 35 ms». Los fps son los del
  medidor de la página (cuadros del juego por segundo); el ping es la ida y vuelta suavizada que el lockstep ya mide con
  cada piloto (`lockstep.estado().rtt`, pings cada 0,5 s), el peor primero. **También apagados por omisión**: medir no
  cuesta, pero tener algo encima del juego obliga al navegador a componer cada cuadro (§98.9), y el panel lo avisa.
- Para medir sin tocar lo guardado: `?escala=2&fluidez=180`; `?graficos=0` = lo de siempre. El registro anota
  «gráficos (§107): …» cuando hay algo distinto, y `window.mkwEstado.graficos` dice qué se usó.

### 107.3 Lo que falta medir con el juego (en la PC del proyecto)

1. **La fluidez en la web.** El port dibuja en un solo hilo y el parche de aurora tocó la interpolación (el presentador
   sin hilo ayudante, `aurora-web.diff`; §88/§53 vaciaron sus tareas pendientes al cerrar el staging). Hay que ver si
   120/180 de verdad dibujan más imágenes en Chrome (el lienzo se presenta al ritmo de `requestAnimationFrame`: con un
   monitor de 240 Hz hay lugar) y cuánto cuesta: `node herramientas/medir-sitio.mjs --perfil pc --etiqueta fluidez180
   --extra "&fluidez=180"` contra la misma sin `--extra`.
2. **La resolución interna**: `--extra "&escala=2"` (y 3, 4): tiempo de GPU por cuadro, que no baje de 60 en la carrera
   con 12 karts. Con WebGPU la memoria de video crece con el cuadrado (2× = 4 veces los pixeles).
3. **En la sala**: con `prueba-sincro --directa --extra=&fluidez=180` que la huella siga igual (debe: es solo la imagen).
Si alguna no anda en la web, sacarla del panel (`ESCALAS`/`FLUIDECES` de `graficos.mjs`).

**Pruebas:**

| Prueba | Resultado |
|---|---|
| Banco `graficos` (nuevo) | 21 / 21 |
| La página sin el programa con `?escala=2&fluidez=180` | `mkwEstado.graficos.lineas` = las dos líneas; el panel en Avanzado; sin errores |

## 2026-10-25 · §108 La resolución en pixeles y la «resolución de salida» para ganar fps

Pedido del dueño: «agrega opciones de resolución que puedan hasta bajar para aumentar fps», «¿resolución en tamaños de
pixeles?».

**Lo que se averiguó:** el juego ya dibuja a lo **mínimo** que acepta el motor. `resolution_multiplier` admite 0 (el
tamaño de la ventana), 1 (la de la Wii), 1,5, 2, 3, 4, 6 y 8 (`settings_overlay.cpp` de WiiCompiled los nombra «Auto
(window size)», «Native (1x)»…); el Config.toml de la página no lo escribe, así que va en 1× = **640×528**. Menos que
eso el motor no lo tiene (habría que parchear aurora y recompilar).

Lo que sí se puede bajar es la **salida**: aurora agranda esa imagen de 640×528 al tamaño del lienzo, y el lienzo lo pone
SDL3 = el tamaño de su recuadro en la página × `devicePixelRatio` (aurora crea la ventana con
`SDL_WINDOW_HIGH_PIXEL_DENSITY`; `Emscripten_HandleResize`, rama `external_size`, mide con
`emscripten_get_element_css_size` = `getBoundingClientRect`). Con un monitor 4K y Windows al 150 %, el lienzo mide
3840×2160: agrandar a eso, cada cuadro, es trabajo de la tarjeta de video.

**Ahora** (`graficos.mjs`):
- **«Resolución de salida»** en Avanzado → Gráficos: la de tu pantalla (lo de siempre), 1920×1080, 1600×900, 1280×720,
  960×540. `limitarSalida(lienzo)` reemplaza el `getBoundingClientRect` **de ese lienzo** por uno que contesta un recuadro
  achicado (el mismo 16:9) para que recuadro × dpr ≤ el alto elegido (`medidaLimitada`); el lienzo sigue ocupando el
  mismo lugar en la página y el navegador lo estira al mostrarlo (gratis: lo hace al componer). Se aplica **en el
  momento** (un aviso `resize`: SDL3 vuelve a medir), se guarda en `mkw.graficos.salida` y no va al Config.toml.
  `?salida=720` para medir.
- **Solo ayuda si lo que frena es la tarjeta de video.** En la PC del proyecto el juego está limitado por el procesador
  (§53: 7,9 ms de CPU por cuadro): ahí no cambia los fps. En un portátil con gráficos integrados y monitor grande, sí.
- La resolución interna se nombra en pixeles: «1× · 640×528 (la de la Wii)», «2× · 1280×1056»…
- **Trampa:** el ratón del menú interno del motor (ImGui, el F1 de WiiCompiled) se mide con ese mismo recuadro: con un
  tope puesto apuntaría mal. La página no lo usa.

**Pruebas:** banco `graficos` 31/31 (+10: los pixeles, el recuadro con dpr 1,5, un «SDL3 de mentira» que con cada
resize pone el lienzo en recuadro × dpr: 1600×900 → 960×540 → de vuelta; el panel lo aplica sin reiniciar). La página
sin el programa con `?salida=540`: el lienzo contesta 540 de alto, sin errores. **Falta medir con el juego**:
`node herramientas/medir-sitio.mjs --perfil pc --extra "&salida=720"` (y con la tarjeta integrada, si hay).
