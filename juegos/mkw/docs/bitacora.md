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
| **Latencia (de audio)** | La demora entre que el juego produce un sonido y se oye. Aquí ~100–150 ms: el bloque del navegador más lo que espera en la cola. |
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
| **Bucket y prefijo (R2)** | Un bucket es un "disco en la nube" de Cloudflare R2; cada archivo es un objeto con una llave (su nombre completo). El prefijo es el comienzo común de las llaves: todo lo de Mario Kart empieza con `mkw/`, así convive con los pedazos de BT3 en el mismo bucket sin mezclarse. |
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
