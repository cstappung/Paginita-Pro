# Plan de trabajo — Mario Kart Wii en el navegador

Estado: ✅ hecho · 🔄 en curso · ⬜ pendiente. Se actualiza en cada avance. Detalle técnico en `docs/analisis.md`.

**Meta:** jugar **Mario Kart Wii con Retro Rewind ya instalado** a **60 fps** con **WebGPU** dentro de Juegos de
Paginita-Pro, con el programa servido solo a amigos desde R2. Retro Rewind es el producto, no un extra: se traduce
junto al juego desde la primera compilación (perfil `retro-rewind`, como el modo `both` del setup de WiiCompiled).
El juego base sin mod queda solo como referencia para depurar. Como BT3: primero que corra, después la página,
después lo social.

---

## Fase 0 — Preparación ✅

- ✅ Analizar WiiCompiled, WheelWizard y Retro Rewind (`docs/analisis.md`)
- ✅ Proyecto en `MKW RETRO` con git y `.gitignore` estricto (nada del juego entra)
- ✅ Disco revisado: `RMCP01` rev 0 (RVZ)
- ✅ El traductor compila en el PC y pasa sus 643 pruebas
- ✅ Extraer `main.dol` + `StaticR.rel` con `nodtool` y verificar sus SHA‑256 contra `recomp.yml` (los dos coinciden)
- ✅ Bajar Retro Rewind v6.13.1 (`update.rwfc.net`, zip completo + delta) a `terceros/RetroRewind/` (nunca al repo)
- ✅ Traducir juego + Retro Rewind a C++ (`herramientas/traducir.ps1`): 29 637 funciones base (7,7 M líneas, 269 MB) + 3 144 del mod, 10 611 parches de RR

## Fase 1 — Pruebas de concepto de lo difícil (antes de invertir en todo lo demás) ✅

Lo que puede tumbar el proyecto se prueba primero, con programas chicos. **Cada prueba es una página suelta
del banco** (`banco/`, ver abajo): se abre en el navegador, muestra en pantalla qué pasó (✓/✗, tiempos, fps) y
se puede publicar como artifact para verla desde otro lado.

- ✅ Instalar Emscripten 6.0.12 (emsdk en `herramientas/emsdk`, Windows nativo, sin WSL)
- ✅ **Fibers sobre JSPI** (bloqueador 13): los de Emscripten solo existen con Asyncify, así que se hicieron a mano sobre JSPI → **funciona**: orden, pilas intactas, espera asíncrona en medio; 0,26 µs por cambio en Node, 0,72 µs en Chrome (`banco/pruebas/fibers/`)
- ✅ **Excepciones C++ entre fibers** (`-fwasm-exceptions`): cada `AccessViolation` la atrapa el `try` de su propio hilo aunque otros estén suspendidos dentro de un `try` (`banco/pruebas/excepciones/`, 4/0)
- ✅ **WebGPU desde C++ con emdawnwebgpu** + `WaitAny` suspendido con JSPI (bloqueador 12): 180 cuadros, lectura de vuelta de la "EFB" en cada cuadro (3,2 ms), color exacto (`banco/pruebas/webgpu/`, 10/0)
- ✅ **FMA exacta rápida** en wasm (bloqueador 8): 90 M casos idénticos a musl; double 5 ns vs 9,3 ns, float 2,5 vs 3,2 (`banco/pruebas/fma/`, 5/0)
- ✅ Compilar **todo** el C++ traducido a wasm (`herramientas/compilar-shard.ps1`, parche `parches/runtime-web.diff`): **202 shards, 0 errores**; juego + RR = 112 MB de objetos → **77,6 MB de wasm (12 MB con brotli)**, V8 lo compila en 70 ms (perezoso); quedan 105 funciones del runtime por poner (fase 2)
- ✅ **Paridad x86 ↔ wasm** de la matemática real del runtime (`banco/pruebas/paridad/`): 22 operaciones (ps_*, fmadd/fmsub/fnm*, frsp con y sin NI, fres, frsqrte, psq) × 1 M casos con NaN/SNaN/subnormales → **22/0 bit a bit**

## Banco de pruebas (`banco/`) — se construye a la par de cada fase

Como el banco de BT3: **simular todo lo que no sea el juego** para probar sin disco, sin servidores y sin amigos
conectados. Nada del juego adentro (los datos falsos solo tienen la *forma*).

- ✅ `banco/index.html`: índice de pruebas (cada una con su ✓/✗) y servidor local (`banco/servir.cjs`, puerto 8130, COOP/COEP)
- ✅ `banco/pruebas/capacidades.html`: ¿el navegador puede correr el juego? (JSPI, WebGPU, WGSL, memoria, excepciones, 60 Hz, mandos, táctil, inclinación) — 14/0 en el PC
- ✅ Páginas de las pruebas de concepto de la fase 1: ✅ fibers · ✅ excepciones · ✅ WebGPU · ✅ FMA · ✅ paridad x86↔wasm
- ⬜ **Disco falso** con la forma del de MKW (árbol `files/` con nombres y tamaños de verdad, relleno adentro) y
  **Retro Rewind falso** (`RetroRewind6/` con la misma forma), para probar la carga por pedido y el overlay
- ⬜ **Worker local** (el `worker.js` de BT3 adaptado) con tokens propios, latencia simulada y modo "sin lote"
- ⬜ **Juego falso**: un `.wasm` chico que imita los ganchos del de verdad (pide archivos, dibuja un cuadro de
  prueba con WebGPU a 60 fps, avisa "empezó la carrera", "terminó, ganó X") para armar la página sin el juego
- ⬜ **Firebase y WebRTC falsos** (BroadcastChannel entre pestañas) para salas y espectadores
- ⬜ **Salas de Retro WFC falsas** (`roomstatus` de mentira con jugadores y Miis inventados)
- 🟡 **Controles simulados** (`banco/pruebas/controles/`, 28/0): mando falso (Gamepad API de mentira), teclas,
  toques de varios dedos (pointer events), inclinación falsa (`deviceorientation`), vibración. Falta: toques
  por CDP en un Pixel 7 vertical/horizontal y que ningún botón táctil choque con otro a ningún tamaño
- ⬜ Pruebas de Playwright (`pruebaNN.cjs`) + `banco/pruebas.ps1` que las corre todas: `N bien, M mal`

## Fase 2 — El juego en wasm, sin pantalla (como `link.py node` de BT3) ✅

- ✅ Parche al runtime (`parches/runtime-web.diff`, 13 archivos): cabeceras (NEON imitado, FPU, `MkwFma`/`MkwFms`, `FlatWriteRam*` comprobado), `guest_flat_memory_wasm.cpp` (memoria en bloques normales), `host_context.cpp` (hilos del juego con JSPI), `main.cpp` (sin manejadores de escritorio), `vi.cpp` (esperas que ceden con `emscripten_sleep`), `dvd.cpp` (sin `realpath`), `runtime_config.h`
- ✅ Receta propia en vez del CMake (`herramientas/compilar-web.py` → Ninja): 397 unidades (runtime, Crypto++, pugixml, xxhash, datos con `#embed`, 161 shards) → `build/web/node/mkw.wasm` de 121,5 MB; enlazado con 0 símbolos sin resolver
- ✅ aurora sin pantalla (`web/headless/`): 146 funciones vacías generadas (`herramientas/generar_aurora_vacia.py`) + 17 a mano (tamaños de textura, FIFO, mandos que Node puede apretar, contador de cuadros, volcado)
- ✅ Extras de escritorio vacíos (`web/headless/escritorio_vacio.cpp`): menú F10 (imgui), Discord, TLS (llega con el en línea)
- ✅ SDL3 del port de Emscripten (3.4.2): sonido (driver "dummy" en Node) y mandos
- ✅ **Corre en Node** (`web/node/correr.mjs`) con el disco extraído y Retro Rewind: arranca el OS, lee 2 037 archivos del disco + 5 482 reemplazos de RR, carga StaticR, corre el código de RR, cambia de escena, **60 fps con ~1 ms de trabajo por cuadro**, deja log y volcado de memoria (152 MB)
- ✅ Prueba del banco `node web/node/prueba-arranque.mjs` → **13 bien, 0 mal**
- ⬜ (pendiente, no bloquea) leer `main.dol`/`StaticR.rel` del disco en vez de embebidos; reloj virtual para correr más rápido que el tiempo real (pruebas y repeticiones deterministas)

## Fase 3 — En el navegador (primer hito ✅: imagen en el canvas a 60 fps)

- ✅ **aurora de verdad sobre WebGPU del navegador** (`parches/aurora-web.diff`, 7 archivos): superficie en el `<canvas id="canvas">` (emdawnwebgpu), sin `dawn::native`, sin hilos (trabajador de cuadros, presentador e interpolación en el mismo hilo), sin `Present()` (el navegador muestra solo), esperas que ceden con JSPI (`staging_map.hpp`, `wait_until_precise`), caché de pipelines en disco apagada
- ✅ Librerías de aurora bajadas con huella (`herramientas/bajar-deps-aurora.sh`: abseil, fmt, imgui, sqlite, tracy); imgui con un parche de una línea (`parches/imgui-web.diff`); zlib/libpng con los ports de Emscripten
- ✅ `herramientas/compilar-web.py --modo navegador`: 579 unidades; los objetos del juego se comparten con el modo node (solo se compilan aurora y sus librerías) → `build/web/navegador/mkw.wasm` 129,7 MB (con nombres de funciones para perfilar)
- ✅ **Archivos del disco por pedido**: `web/navegador/servidor.mjs` (solo 127.0.0.1) arma un manifiesto (6 065 archivos + carpetas vacías) y sirve con HTTP Range; la página (`web/navegador/mkw.mjs`) crea el sistema de archivos en memoria con los chicos (29 archivos, 9,9 MB) y los grandes "perezosos"; el runtime lee los grandes por `Module.mkwLeeRango` (parche a `dvd_contract.h`/`dvd.cpp`). Pantalla de título: 85 lecturas, 19,9 MB
- ✅ Runtime: sin enlaces duros en la NAND (`nand_settings.h`, `nand_api.cpp`), contador de cuadros para la página (`vi.cpp`)
- ✅ **Pantalla de título de Retro Rewind dibujada en Chrome a 60,0 fps estables, ~7,3 ms de trabajo por cuadro** (Ryzen 9800X3D + GPU AMD RDNA2 del navegador)
- ✅ Prueba del banco `node web/navegador/prueba-navegador.mjs` (Playwright + el Chrome instalado, sin sonido) → **15 bien, 0 mal** (con ventana y sin ventana; incluye enganche al monitor y que el juego responde a la tecla A); opciones `--perfil S` (qué funciones gastan el tiempo) y `--pausa S` (dónde se trabó)
- ✅ **Cuadros alineados con el refresco del monitor** (PLL en `vi.cpp` + reloj del monitor en la página): la grilla del reloj VI se corre ≤0,25 ms por cuadro para que cada barrido caiga en la fase elegida respecto de un refresco (justo después, o para que el cuadro termine a mitad de refresco si dura varios), y la espera final despierta con `requestAnimationFrame`. Monitor de 240 Hz: **99,0 % de los cuadros duran exactamente 4 refrescos** (sin enganche: 90,7 %). Solo engancha si el monitor es múltiplo de 60 Hz; `?enganche=0` lo apaga para comparar
- ✅ **Tarjeta de video**: la página ya no ofrece elegirla (decisión del dueño, 20:55: en Windows no sirve, decide Windows). Muestra cuál da el navegador y, si ignora el pedido, una ayuda plegada y discreta para cambiarla desde Windows. `?gpu=bajo|auto` queda solo para pruebas. En este PC Chrome usó la integrada AMD y, más tarde, la RTX (NVIDIA Ampere)
- ✅ **Caché del disco** (`web/navegador/disco.mjs`, como BT3): bloques de 256 KB en Cache Storage + 64 MB en memoria,
  un pedido por tramo, versión del servidor (`X-Mkw-Version`) que tira la caché vieja, "Borrar datos del juego" en
  Opciones. Segunda apertura: **0 pedidos a la red**. Banco `pruebas/disco/` 15/0. (El tirón del arranque sigue: es CPU)
- ✅ **Viewport de WebGPU limitado a 0–1** (aurora, `common.cpp`): la carrera se colgaba con maxDepth 1,06
- ✅ **Sonido**: SDL3 ya lo manda a WebAudio (un ScriptProcessorNode de 2048 muestras = 42,7 ms). `web/navegador/sonido.mjs`
  se mete entre SDL3 y los parlantes sin tocar SDL3 (reemplaza `AudioContext` antes de cargar el juego):
  - ✅ **Desbloqueo** con el primer toque, clic o tecla (Chrome no deja sonar una página antes) y un aviso discreto mientras tanto
  - ✅ **Volumen** (curva al cuadrado) y **silencio** en "Opciones", guardados en el navegador
  - ✅ **Medidor**: nivel en dB, bloques, huecos (cortes), costo por bloque (0,05 ms: nada)
  - ✅ **Ajuste fino del ritmo** (parche a `audio_backend.cpp`, un PI como el filtro de un PLL): el juego produce
    sonido ~0,13 % más rápido de lo que la tarjeta lo consume (la Wii real va a ~32 029 Hz, no 32 000, más el
    enganche al monitor de 240,1 Hz). Sin ajuste se tiran **2 bloques en 25 s** (cortes audibles); con ajuste la
    cola queda en 50–90 ms (objetivo 60, tope 120) y **0 cortes**. `?ajusteSonido=0` lo apaga para comparar
  - ✅ Pruebas: `banco/pruebas/sonido/` **13/0** (sin el juego; necesita un clic) y en la prueba del navegador
    (bloqueo simulado con `?bloquearSonido=1` porque Chrome manejado por Playwright nunca bloquea): desbloqueo con
    el clic, música del título a −14 dB, sin cortes desde el cuadro 300, cola centrada
  - ⬜ Cortes en el arranque (2 huecos + bloques tirados mientras el juego se traba leyendo el disco): se irán
    con la caché de lo bajado del disco. Latencia ~100–150 ms (bloque de 43 ms + cola de 60): bajarla con un
    AudioWorklet en vez del ScriptProcessorNode
- ✅ **Controles** (todos llegan al juego como un mando de GameCube por puerto): `web/navegador/pad_web.cpp`
  reemplaza el `pad.cpp` de aurora (que leía SDL) y la página lo llena con `_mkw_web_pad(puerto, …)` en cada
  refresco; `web/navegador/controles.mjs` junta las fuentes:
  - ✅ **Teclado**: stick WASD/flechas, A = K/Enter (acelerar), B = J/Retroceso, R = L/Shift (derrapar),
    L = Espacio/I (objeto), cruz T/G/F/H (truco = T), X = U, Y = O, Z = N, Start = P/Esc; configurable en la
    página (clic + tecla nueva), guardado en `localStorage`
  - ✅ **Mandos** por Gamepad API (mapeo "standard": Xbox, PlayStation, Switch Pro, genéricos); el primero
    comparte el puerto 1 con el teclado, los siguientes van a los puertos 2–4 (pantalla dividida); zona muerta
    de 15 %, gatillos analógicos, **vibración** cuando el juego la pide (`PADControlMotor` → `vibrationActuator`)
  - 🟡 **Celular**: mando táctil sobre el juego (stick + A/B/R/L/↑/Start, varios dedos, re-mide en cada dedo,
    deslizar de un botón a otro), **dirigir inclinando el teléfono** (35° = a fondo), pantalla completa y
    horizontal, vibración con `navigator.vibrate`. ✅ Tamaño (80–130 %) y opacidad ajustables, recuadro a pantalla
    completa, medidas en cqmin; `prueba-tactil.mjs` en un Pixel 7 emulado parado y acostado **16/0**. Falta: un
    teléfono de verdad
  - ✅ Panel "Controles" en la página: tabla de teclas, mandos conectados, lo que recibe el puerto 1
  - ✅ Pruebas: `banco/pruebas/controles/` (28/0, sin el juego) y en el juego de verdad: la tecla K llega como A
    y la pantalla de título pasa a la de licencias (prueba del navegador **15/0**)
- ✅ **Cuadros parejos varían entre corridas** → la medida vieja contaba el contador del juego, no la pantalla; con
  la traza de Chrome la fase de antes daba 50–65 % parejos de verdad a 240 Hz. Arreglo: el reloj VI se pone en la
  fase que deja la presentación de Chrome a mitad del refresco; la prueba mide la pantalla (≥ 90 %, justificado en
  bitácora §43). Y el runtime ya no gira entre cuadros: espera cediendo, con el refresco (§48; hilo principal 80 → 37 %).
- ✅ **Tirones al entrar al menú y en la largada** (bitácora §50–51): eran dos cosas. (1) ~9.300 búsquedas de
  nombres en el índice del disco al cargar la carrera (337–389 ms en wasm) → búsqueda nativa con tabla hash
  (`web/dvd/rutas_nativo.cpp`, 9–13 ms, 25.413 respuestas iguales a la del juego). (2) Chrome compilando 30–80
  pipelines nuevos de golpe (~25 ms cada uno, imagen congelada 2 s) → aurora los pide en segundo plano y salta el
  dibujo hasta que llegan, y se precalientan al arrancar con la lista de este navegador (IndexedDB) y una semilla
  junto al `.wasm` (`pipelines.mjs`). Largada: 2 s a 2–4 fps → un segundo a 34 fps (la carga, 209 ms de red) y
  después 60. Banco `pruebas/pipelines/` 14/0, navegador 21/0
- ✅ **Bajar antes los archivos** (bitácora §52): avisos del juego al encontrar un archivo (`rutas_nativo.cpp` →
  `mkwAvisoLectura`), lectura adelantada para lo que se lee en orden, `cache: 'no-store'` (Chrome ponía en fila los
  pedidos al mismo archivo), los 613 archivos ≤ 8 KB con prioridad baja, grupos de sonido del BRSAR enteros
  (`brsar.mjs`) y semilla de bloques (`bloques.json`, `guion.mjs --semilla` ×3). Con 50 ms de latencia simulada
  (`MKW_LATENCIA=50`): espera al disco 30,1 s → 5,0 s. Banco `disco` 27/0, `brsar` 9/0, navegador 21/0
- ✅ **Presentación y cuenta regresiva de la carrera a 17–20 ms por cuadro** (bitácora §53): era aurora mapeando un
  búfer de preparación de 37 MB por cuadro (Emscripten lo llenaba de ceros y lo copiaba entero). Ahora un bloque
  normal + `Queue::WriteBuffer` de lo usado (~1,5 MB), y sin el giro de la pausa de presentar. CPU del juego
  13,3 → 7,9 ms por cuadro; cuadros pasados de 16,7 ms 336 → 9 de 1140. `herramientas/medir-cpu.sh`,
  `tiempos-cuadro.mjs`, `guion.mjs --traza`. Navegador 21/0, partidas 6/0, celular 16/0
- ✅ **Medir como en la página real** (bitácora §54): `herramientas/sitio-local.mjs` (el sitio servido como GitHub
  Pages sin COOP/COEP + el juego en el marco de Juegos + lo privado desde otro origen con CORS y 50 ms) y
  `herramientas/medir-sitio.mjs` (perfiles `pc`, `cpu4`, `celular`; CPU por cuadro p95/p99, ritmo en pantalla, GPU,
  hilo ocupado, heap, MB, 1.ª y 2.ª visita). PC: 60 fps, 7,97 ms por cuadro, 0 tirones; CPU frenada ×4: 17,7 fps;
  celular emulado: 4 fps (el freno de Chrome no escala parejo: medir en un teléfono real)
- ✅ **Tirón en carrera** (§54): la toma del canvas a compás (cede siempre, deja correr la actualización atrasada,
  toma en "anterior + 4"): tomas parejas 83 → 98,6 %, CPU 9,4 → ~8 ms. `?esperaToma=0`, `?atrasada=0`, `?compas=0`
- ✅ **Primer toque de las voces de los personajes al azar** (§54): los 42 grupos de voces de CPU del BRSAR (nombres
  de la sección SYMB) y los 174 archivos de voces de CPU de RR, con prioridad baja; cada bloque se entrega apenas
  está. Espera en la largada ~1000 → ~60 ms. `?voces=0`
- ✅ **Carga del programa** (§54): `mkw.wasm.br` (124,3 → 16,1 MB, ningún archivo > 100 MB), con huella (`?v=`) y
  guardable para siempre; 2.ª visita sin bajarlo ni compilarlo (primer cuadro 7,9 → 2,3 s a 50 Mbit/s).
  `compilar-web.py --final`. Descartado: `wasm-opt -O3` (sin ganancia)
- ⬜ **El Worker de verdad**: entregar el programa como en `servidor.mjs` (§54: `immutable` con `?v=`,
  `mkw.wasm.br` con `Content-Encoding: br`, `X-Mkw-Build` en el manifiesto). Lo publica el dueño
- ⬜ **CPU del juego en equipos débiles**: medir en un teléfono real (Android con Chrome) y, si no llega a 60, buscar
  dónde recortar el trabajo del juego traducido (el perfil frenado es el de siempre: juego, sonido, aurora)
- ⬜ **Subir las semillas** (`build/web/navegador/pipelines.bin` y `bloques.json`) a R2 junto al `.wasm` al publicar
  (fase 6), y rehacerlas (`guion.mjs … --semilla`, 3 veces) cada vez que cambie aurora o el disco
- ✅ **Partidas guardadas** (`web/navegador/guardado.mjs`): partida de RR (`rksys.dat`), NAND (ajustes de RR y de la
  consola) y lo nuevo en la SD (fantasmas) se guardan solos en IndexedDB (enganche a cerrar/renombrar/borrar del
  sistema de archivos, medio segundo después del último cambio) y vuelven antes del `main()` al reabrir. Descargar /
  Cargar / Borrar en "Opciones". Paquete `.mkwp` (gzip) listo para la nube. Banco `pruebas/guardado/` 15/0 (MEMFS
  real); con el juego `prueba-partidas.mjs` 6/0 (licencia que sobrevive a recargar)
- ✅ **Todo desbloqueado**: lo hace Retro Rewind ("Unlock Everything", siempre activo según la wiki): licencia nueva
  con los 24 personajes, todos los vehículos y todas las copas, más los personajes propios de RR. Revisado con
  `web/navegador/guion.mjs` (maneja el juego con teclas y saca fotos)
- ✅ **60 fps estables** en el PC de trabajo: ✅ título (~7 ms), ✅ **carrera con 12 karts: 60 fps, ~11 ms** (largada 14–17 ms);
  ✅ **elegir pista: 60 fps, 13–15 ms** (era 24–31 fps: el video THP de 672×736 a 60 cuadros/s; ahora lo decodifica
  `web/thp/` en nativo, ~0,9 ms por cuadro; bitácora §47)
- ✅ **SIMD** (`-msimd128`) **es lo normal** desde 22:45 (runtime, juego y aurora): elegir pista 28–33 fps (−13 % de
  trabajo), carrera igual; paridad 22/0, Node 13/0, navegador 20/0. `--sin-simd` compila sin SIMD aparte
  (`build/web-sin-simd/`) para comparar. ✅ Elegir pista a 60 con el THP nativo (acelerar psq_l/psq_st se probó y se deshizo: la carrera empeoraba 14 %)

## Fase 4 — Retro Rewind completo en el navegador

- ⬜ Overlay de `RetroRewind6/` (pistas, personajes, música) sobre los archivos del disco, servido por pedido igual que el disco
- 🟡 Ajustes de Pulsar: `RRGameSettings.pul` ya se guarda (NAND `shared2/Pulsar/RetroRewind6/`); falta ver dónde caen `RRSettings.pul` (trofeos) y `RRRating.pul` (VR) al jugar contrarreloj / en línea
- ⬜ Actualizar a una versión nueva de RR = bajar el delta, retraducir `Code.pul`, recompilar, subir a R2 (script)

## Fase 5 — En el sitio (repo Paginita-Pro)

- 🟡 `juegos/mkw/`: página propia con la cara del sitio (§55: inicio, modos, barra, cajón, «Tu partida», Mi Mii, piloto); ⬜ integrarla en `juegos.html` (marco `jg-mkw-solo`, `volumen.js`, `i18n.js`)
- ⬜ `.wasm` + archivos del disco en R2, servidos por el Worker solo a `AMIGOS` (lotes, Cache Storage)
- ⬜ Oculto salvo amigos (`juegoOculto()`); nada se baja desde el vestíbulo
- 🟡 **Partidas en la nube** (`web/navegador/nube.mjs`): el paquete `.mkwp` en Firebase Storage `mkw/<uid>/partidas.mkwp`
  con huella SHA-256 y hora de juego en los metadatos; al entrar sube, baja o no hace nada según las huellas; conflictos
  → gana la jugada más recientemente y la otra queda de respaldo; subida automática con espera y tope de frecuencia.
  Banco `pruebas/nube/` (Firebase falso con las reglas) **23/0**. Regla y código para la página en `docs/firebase-mkw.md`.
  ⬜ Conectarlo en `juegos/mkw/` con el inicio de sesión real; ⬜ el dueño publica la regla de Storage
- ⬜ Banco de pruebas y pruebas de Playwright (como el de BT3)

## Fase 6 — En línea y social

- 🟡 **Salas de Retro WFC en vivo** (`web/navegador/salas.mjs`): lee `rwfc.net/api/roomstatus` directo (responde CORS `*`:
  **no hace falta el Worker**), salas con gente ordenadas, sondeo cada 15 s solo con la pestaña a la vista, código de
  amigo con su control MD5 (Tockdom; verificado 280/0 con el servidor real) y buscar amigo. Banco `pruebas/salas/` 19/0.
  ⬜ Panel en la página del sitio; ⬜ código de amigo propio desde `rksys.dat`; ⬜ qué significa cada `rk`
- 🟡 Jugar en línea por la página: diseño "WFC virtual" en `docs/en-linea.md` (sockets de la Wii → JS, UDP por WebRTC, WFC chiquito en la pestaña del anfitrión, Firebase solo presenta). ⬜ F0 sockets ⬜ F1 WFC virtual ⬜ F2 transporte ⬜ F3 sala (cola de pistas tipo playlist, hasta 12, 45 s entre pistas con «Confirmar»; entrar con la carrera andando: «siguiente carrera» o «sala», mirando mientras tanto) ⬜ F4
- ⬜ Espectadores (`bt3-directo.js` adaptado a canvas WebGPU)

## Modos de la página (§55)

- ✅ Gran Premio (copa elegida) y Carrera (pista elegida) con el piloto, nombres de las pistas leídos del juego
- ✅ Mi Mii (base de Mii de la Wii, caras de partida); ⬜ fotos reales de las caras (sacadas del juego, a R2)
- ⬜ Copa a tu gusto (4 pistas elegidas o al azar con semilla nueva, reordenar y volver a sortear)
- ⬜ Contrarreloj; ⬜ CPU: dificultad o sin CPU en todos los modos (probado: sin CPU funciona); ⬜ cilindrada y personaje
- ⬜ Récords de tiempo por pista y cilindrada en Firebase (el tiempo final se lee de la memoria: Raceinfo 0x809BD730)
- ⬜ Imágenes sacadas del juego para elegir: foto de cada pista, ícono de cada copa (a R2 con el `.wasm`, nunca a git)

---

## Riesgos abiertos

1. **Rendimiento a 60 fps** con memoria comprobada (todo acceso pasa por la tabla de páginas) + byteswap sin instrucción nativa. La FMA ya no es problema (propia, ~2× musl). Medido (00:10): título ~7 ms, elegir pista 12–14 ms (THP nativo), carrera con 12 karts ~10 ms: **todo a 60 fps** salvo ~2 s de la largada.
2. ~~Fibers sin Asyncify~~ → resuelto con fibers a mano sobre JSPI, excepciones incluidas.
3. ~~Tamaño del `.wasm`~~ → medido: 77,6 MB sin quitar código muerto, **12 MB con brotli**; V8 compila perezoso (70 ms). Falta ver TurboFan con el juego corriendo.
4. **NaN en clientes ARM**: las sumas/multiplicaciones sueltas del código traducido (no las del runtime) dan NaN con otros bits en un celular ARM que en un PC x86. Solo importa si el juego compara bits de un NaN (raro); vigilar en ghosts/en línea.
5. **FPSCR[NI] sin flush-to-zero**: wasm no tiene modo FTZ; solo `frsp` respeta NI. Hay que ver si MKW activa NI y si se nota.
8. ~~Costo de dibujar~~ → medido: título ~7,3 ms, carrera ~10 ms, elegir pista 12–14 ms; queda el tirón de la largada (ver fase 3).
9. ~~Temporizadores del navegador~~ → resuelto: reloj VI enganchado al refresco del monitor, en la fase que deja la presentación de Chrome a mitad del refresco (90–100 % de cuadros parejos EN PANTALLA a 240 Hz, medido con la traza de Chrome; §43). Queda: monitores no múltiplos de 60 Hz (144 Hz) no pueden ir parejos a 60 fps.
10. **GPU equivocada**: en Windows el navegador elige la tarjeta (la página no puede). La página muestra cuál usa y ofrece, plegada, cómo cambiarla desde Windows; llevar lo mismo a la página del sitio.
6. **Online**: sin sockets UDP en el navegador; depende de infraestructura propia.
7. **Legal**: el `.wasm` y los archivos de RR nunca son públicos.

## Registro de avances

(Fecha y hora local de cada avance; el más nuevo arriba.)

- **2026-10-17 13:30** — **La página con la cara del sitio, tu partida, Mi Mii y el piloto** (§55). `index.html` nuevo (juego a toda ventana, tarjeta de inicio, modos, barra que se esconde, cajón, diálogos propios) con `interfaz.mjs`; cargar el rksys.dat de una Wii/Dolphin o un .mkwp con revisión de CRC, descargar, copias de respaldo automáticas (`licencias.mjs`, `respaldos.mjs`); «Mi Mii» arma la base de Mii de la Wii (`mii.mjs`, CRC-16/XMODEM) con caras de partida, y el juego los lista al crear la licencia; el piloto (`menus.mjs`) lee la memoria del juego (`mkw_web_mem`) y lleva solo a una pista de Carrera o a una copa de Gran Premio, con los nombres de las ~360 pistas leídos del juego. En línea diseñado (`docs/en-linea.md`). Banco 19/0, 11/0; piloto 9/0; navegador 20/0; partidas 6/0; celular 16/0.
- **2026-10-17 06:30** — **Medido como en la página real y arreglados el tirón en carrera y la carga** (§54). Sitio local como GitHub Pages (sin aislamiento) con el juego en el marco de Juegos y lo privado desde otro origen; `medir-sitio.mjs` en 3 perfiles. Toma del canvas a compás (tomas parejas 83 → 98,6 %), voces de los CPU bajadas antes (largada ~1 s → ~60 ms de disco), `.wasm` brotli 16,1 MB con huella y caché (2.ª visita: primer cuadro 2,3 s, 0 tirones). PC 60 fps, 7,97 ms por cuadro (p99 12,0). Descartados: margen de toma, `wasm-opt -O3`. Navegador 21/0, partidas 6/0, celular 16/0.
- **2026-10-17 04:10** — **La presentación de la carrera ya cabe en el cuadro** (§53). La traza del ritmo con contadores de espera (`guion.mjs --traza`, `herramientas/tiempos-cuadro.mjs`) mostró CPU real de 14–17 ms; el perfil con columnas apuntó al pegamento de WebGPU: aurora mapeaba 37 MB por cuadro y Emscripten los llenaba de ceros y los copiaba enteros. Ahora un bloque plano y `Queue::WriteBuffer` solo de lo usado (~1,5 MB), y la pausa de presentar ya no gira. CPU del juego 13,3 → 7,9 ms; cuadros > 16,7 ms 336 → 9 de 1140; hilo principal 29 % → 21 %. Navegador 21/0 ×2, partidas 6/0, celular 16/0.
- **2026-10-17 02:40** — **Bajar antes los archivos** (§52): avisos del juego, lectura adelantada, sin el bloqueo de la caché HTTP de Chrome, archivos diminutos y semilla de bloques con prioridad baja que se aparta de las cargas, grupos de sonido enteros. Con 50 ms de latencia simulada la espera al disco pasa de 30,1 s a 5,0 s; en red local de 3,4 s a 1,5 s. La prueba del navegador mide desde el cuadro 420 (el título carga entre el 300 y el 360). Banco `disco` 27/0, `brsar` 9/0, Node 13/0, navegador 21/0 ×3.
- **2026-10-17 01:30** — **Tirón de la largada resuelto** (§50–51). Búsqueda de archivos en el índice del disco nativa con tabla hash (337–389 ms → 9–13 ms por ráfaga; 25.413 respuestas iguales a las del juego). Pipelines de WebGPU en segundo plano (saltando el dibujo hasta que llegan) y precalentados al arrancar con la lista guardada en IndexedDB más una semilla de 414 junto al `.wasm`. Largada: 2 s a 2–4 fps → un segundo a 34 fps (carga, 209 ms de red), después 60; menús sin congelones. Node 13/0, navegador 21/0, banco `pipelines` 14/0.
- **2026-10-17 00:11** — **Repaso final con todo junto** (SIMD + THP nativo + esperas que ceden) en `build/web/`, con el PC tranquilo: 13 páginas del banco en verde, Node 13/0, navegador 20/0 ×2 (99–100 % parejos, hilo principal 35 %), partidas 6/0, táctil 16/0. Elegir pista 60 fps (12–14 ms), carrera 60 fps (~10 ms). Queda el tirón de ~2 s en la largada.
- **2026-10-17 00:05** — **El juego espera cediendo**: entre cuadros ya no gira; la página lo despierta con el refresco justo antes de la tele (en una tarea nueva) y gira solo 0,75 ms. Hilo principal de la página ocupado 80 → 37 %, cuadros parejos en pantalla iguales (A/B 4+4: 96,7–99,2 % contra 94,2–100 %). Fotos del canvas en el rAF de la toma. Navegador 20/0, Node 13/0. Bitácora §48.
- **2026-10-16 23:55** — **Elegir pista a 60 fps** (era 24–31 fps, 36–42 ms → 13–15 ms): era el video THP (672×736 a 59,94 cuadros/s). Decodificador nativo escrito desde el formato JPEG público (`web/thp/`), enganchado sin retraducir (`compilar-web.py` le cambia el nombre a `THPVideoDecode` en su shard): ~0,9 ms por cuadro contra ~9,5 ms del traducido; igual a libjpeg ±1. `?thp=traducido`/`?thp=comparar` para comparar. Banco THP 8/0 (cuadros falsos), paridad 22/0 ×2, Node 13/0, navegador 20/0, carrera 60 fps ~10,5 ms. El atajo de psq_l/psq_st se probó y se deshizo (carrera +14 %). Bitácora §47.
- **2026-10-16 23:55** — **Salas de Retro WFC en vivo** (`salas.mjs`): la API se lee directo desde la página (CORS abierto, sin Worker); código de amigo validado con su control MD5 según Tockdom (280/0 con el servidor real); buscar amigo. Banco con datos falsos 19/0.
- **2026-10-16 23:45** — **Partidas en la nube** (`nube.mjs`): sincroniza el paquete de partidas con Firebase Storage por huellas; conflictos con respaldo. Banco con Firebase falso que aplica las reglas: 23/0. Regla de Storage propuesta en `docs/firebase-mkw.md` (la publica el dueño).
- **2026-10-16 22:51** — **SIMD es lo normal**: `compilar-web.py` compila todo con `-msimd128` (navegador y Node recompilados en `build/web/`); `--sin-simd` queda para comparar.
- **2026-10-16 22:45** — Repaso completo: banco (controles 28/0, disco 15/0, guardado 15/0, sonido 13/0, paridad 22/0), Node 13/0, navegador 20/0 ×3, partidas 6/0, táctil 16/0. Arreglados: la prueba de sonido intermitente (SDL3 desbloqueaba antes del clic bajo Playwright) y un error sin atender de la caché del disco cuando falla la red.
- **2026-10-16 22:35** — **Cuadros parejos, de verdad**: la verificación vieja no miraba la pantalla (la traza de Chrome mostró 50–65 % parejos a 240 Hz mientras la página decía 99 %). El reloj VI ahora se pone en la fase que deja la presentación de Chrome a mitad del refresco (medida sola por la página, con banda muerta): 90–100 % en pantalla, 99–100 % con el PC tranquilo. La prueba del navegador mide la pantalla con la traza de Chrome (≥ 90 %): 20/0; Node 13/0. Bitácora §43.
- **2026-10-16 22:25** — **La carrera va a 60 fps** (12 karts, ~11 ms por cuadro). La medición anterior de "27 fps en carrera" era en realidad la pantalla de elegir pista (25–28 fps, probablemente el video THP). **SIMD** (`--simd`, build aparte): esa pantalla −13 % de trabajo; paridad 22/0, Node 13/0, navegador 20/0. Arreglada de paso la prueba de paridad en Node (tipo de módulo).
- **2026-10-16 22:05** — **Mando táctil**: tamaño y opacidad ajustables, recuadro a pantalla completa en el celular, botones medidos en cqmin; prueba nueva en un Pixel 7 emulado (parado y acostado, 11 tamaños, toques reales por CDP) 16/0 tras rehacer la distribución (A pisaba a B). Banco de controles 28/0.
- **2026-10-16 21:58** — **Primera carrera en el navegador**: se colgaba por un viewport con profundidad 1,06 (WebGPU exige 0–1): limitado en aurora.
- **2026-10-16 21:52** — **Caché del disco** en Cache Storage (bloques de 256 KB, versión del servidor): al reabrir, 0 pedidos a la red. Banco 15/0. El tirón del arranque no era la red.
- **2026-10-16 21:45** — **Partidas guardadas**: la licencia, los ajustes y los fantasmas se guardan solos en IndexedDB y vuelven al reabrir; Descargar/Cargar/Borrar; paquete `.mkwp` listo para Firebase Storage (fase 5). Banco 15/0, con el juego 6/0.
- **2026-10-16 21:20** — **Todo viene desbloqueado** (Retro Rewind "Unlock Everything"): revisado en el juego con el guion nuevo (`guion.mjs`). La wiki mkwiiki.org pasa a ser la referencia de qué hay en el juego.
- **2026-10-16 21:02** — **Sonido**: volumen, silencio, desbloqueo con el primer toque y medidor (`sonido.mjs`); ajuste fino del ritmo en el runtime (PI) que elimina los cortes por deriva de reloj (~0,13 %). Banco de sonido 13/0; prueba del navegador 19/1 (falla solo "cuadros parejos", que varía igual sin el sonido). Se quitó la opción de tarjeta de video (pedido del dueño): queda una ayuda discreta.
- **2026-10-16 20:40** — **Controles**: teclado (configurable), mandos (Gamepad API, hasta 4, con vibración) y celular (táctil + inclinar) llegan al juego como mandos de GameCube. Banco de controles 28/0; en Chrome la tecla K aprieta A y el juego pasa del título a las licencias: prueba del navegador 15/0. La medición de 60 fps ya no cuenta el final de la carga del arranque.
- **2026-10-16 20:20** — **Reloj del juego enganchado al monitor**: 99,0 % de cuadros parejos en 240 Hz (sin enganche 90,7 %), 60,0 fps; prueba del navegador 13/0 (con y sin ventana), Node 13/0.
- **2026-10-16 20:10** — Opción "Tarjeta de video" en la página, con aviso cuando el navegador la ignora (Chrome en Windows). Hallazgo: Chrome usa la GPU integrada AMD, no la RTX.
- **2026-10-16 20:02** — El monitor resultó de 240 Hz (no 180): rAF se salta refrescos mientras el juego calcula. Período medido por hora; fase elegida para que el cuadro termine a mitad de refresco.

- **2026-10-16 19:55** — **Fase 3, primer hito: Mario Kart Retro Rewind en Chrome con WebGPU a 60,0 fps** (~7,3 ms de trabajo por cuadro). Prueba del banco con Playwright 12/0; Node sigue 13/0. Las pruebas corren sin sonido (pedido del dueño).
- **2026-10-16 19:50** — El perfil mostró que 2/3 del tiempo se iba en el registro de la página (redibujaba por línea) y en el sonido intentando crear un hilo; arreglado: de ~46 a 60,0 fps.
- **2026-10-16 19:42** — **Primera imagen en el canvas**: la pantalla de título de Retro Rewind. Faltaba que aurora cediera el control mientras espera un búfer de la GPU (MapAsync).
- **2026-10-16 19:35** — El juego arranca en el navegador: WebGPU creado sobre el canvas, NAND (sin enlaces duros), disco leído por HTTP Range.
- **2026-10-16 19:27** — `mkw.wasm` para el navegador enlazado a la primera (126,9 MB): aurora real + abseil/fmt/imgui/sqlite.
- **2026-10-16 19:00** — Empieza la fase 3: mapa de aurora (Dawn nativo solo en 2 archivos; hilos en 4 lugares), librerías bajadas con huella.

- **2026-10-16 19:09** — **Fase 2 terminada.** Prueba de arranque en Node: 13/0 (disco, OS, Retro Rewind, escenas, 60 fps, ~1 ms de trabajo por cuadro, volcado de memoria).
- **2026-10-16 19:05** — Las esperas del juego ahora ceden el control (`emscripten_sleep` con JSPI) en vez de girar en vacío: el navegador no se congelará y se puede medir el trabajo real por cuadro.
- **2026-10-16 18:58** — 1 200 cuadros seguidos a 60,0 fps con sonido (driver "dummy") y volcado de memoria.
- **2026-10-16 18:50** — **El juego corre en Node**: lee el disco, carga StaticR, ejecuta el código de Retro Rewind y llega al bucle de cuadros.
- **2026-10-16 18:45** — Todo enlazado en un solo `mkw.wasm` (121,5 MB) sin símbolos faltantes.
- **2026-10-16 18:40** — Las 397 unidades (runtime + librerías + datos + juego) compilan a wasm con `herramientas/compilar-web.py`.
- **2026-10-16 18:28** — Empieza la fase 2: mapa del runtime (agente), SDL3 del port de Emscripten, backend de hilos con JSPI.
- **2026-10-16 18:24** — **Fase 1 terminada.** Paridad x86 ↔ wasm: la matemática real del runtime da los mismos bits en las 22 operaciones probadas (22/0, Node y Chrome). Para lograrlo, `MkwFma`/`MkwFms`: FMA propia exacta que además devuelve los NaN como x86 (la de musl devolvía un SNaN sin silenciar).
- **2026-10-16 18:14** — **Todo el juego + Retro Rewind compila a wasm**: 202 shards, 0 errores, con un parche chico a 5 cabeceras + 1 nueva (`parches/runtime-web.diff`). Enlazado de prueba: 77,6 MB (12 MB con brotli), V8 lo compila en 70 ms.
- **2026-10-16 18:05** — Empieza el parche del runtime para wasm: un shard traducido ya se intenta compilar con em++; fallan solo las 3 cabeceras previstas (base de memoria, SIMD, FPU).
- **2026-10-16 18:04** — Excepciones C++ entre fibers: cada una la atrapa el hilo correcto (4/0). FMA exacta: 90 millones de casos idénticos a musl y ~2× más rápida en double (5/0).
- **2026-10-16 18:00** — WebGPU desde C++ (emdawnwebgpu) con las esperas de aurora suspendidas por JSPI: 180 cuadros, lectura de vuelta por cuadro en 3,2 ms, color correcto (10/0).
- **2026-10-16 17:56** — Fibers sobre JSPI funcionan (el bloqueador más serio de los hilos, resuelto). Banco con capacidades (14/0) y fibers (4/0) en verde.
- **2026-10-16 17:52** — Emscripten 6.0.12 instalado en `herramientas/emsdk`.
- **2026-10-16 17:49** — Juego + Retro Rewind traducidos a C++ (`herramientas/traducir.ps1`): 29 637 + 3 144 funciones, 10 611 parches del mod.
- **2026-10-16 17:47** — Retro Rewind 6.13.1 bajado e instalado (zip completo + delta).
- **2026-10-16 17:45** — Disco extraído con nodtool; `main.dol` y `StaticR.rel` con los SHA-256 exactos que exige WiiCompiled.
- **2026-10-16 17:42** — Retro Rewind pasa a ser el producto principal; banco de pruebas, controles (teclado, mandos, celular) y bitácora entran al plan (decisiones del dueño).
- **2026-10-16 17:44** — Traductor de WiiCompiled compilado (643/643 pruebas).
- **2026-10-16 17:40** — Proyecto creado (git, `.gitignore` estricto, `CLAUDE.md`, `PLAN.md`, `docs/analisis.md`). Disco revisado: `RMCP01` rev 0.
- **2026-10-16 17:35** — Análisis de WiiCompiled, WheelWizard y la wiki de Retro Rewind terminado.
