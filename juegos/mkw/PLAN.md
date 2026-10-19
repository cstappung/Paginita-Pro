# Plan de trabajo — Mario Kart Wii en el navegador

Estado: ✅ hecho · 🔄 en curso · ⬜ pendiente. Se actualiza en cada avance. Detalle técnico en `docs/analisis.md`.

**Meta:** jugar **Mario Kart Wii con Retro Rewind ya instalado** a **60 fps** con **WebGPU** dentro de Juegos de
Paginita-Pro, con el programa servido solo a amigos desde R2. Retro Rewind es el producto, no un extra: se traduce
junto al juego desde la primera compilación (perfil `retro-rewind`, como el modo `both` del setup de WiiCompiled).
El juego base sin mod queda solo como referencia para depurar. Como BT3: primero que corra, después la página,
después lo social.

---

## Lo que falta, en orden (plan del 2026-10-18)

**Dónde estamos:** el juego corre en Chrome a 60 fps (~8,5 ms de procesador por cuadro de 16,7), con controles,
sonido, partidas, caché, página propia con sus modos, en línea por nuestra página (WFC en la pestaña del anfitrión +
malla WebRTC) y carrera sincronizada con CPU de relleno en la sala del sitio. Todo probado **en este PC**. Falta
publicarlo (Worker + R2), guardarlo en git y terminar el en línea.

**Decisiones del dueño (2026-10-18):**
- Commits en la rama del sitio y en el repo local: **sí**. **PR: no** (el dueño lo retiró el 2026-10-18 19:50: "dont pR"); tampoco push mientras no lo pida. Merge: cuando él lo diga.
- El Worker de Mario Kart usa **el mismo Worker y la misma lista de amigos que BT3**; el Worker y la subida a R2
  **los hace el dueño** (aquí se prepara todo lo que necesita: qué servir, el programa final, la lista de archivos).
- **El VR solo se mueve en línea** (VS por el WFC de la sala). La carrera sincronizada con CPU no lo toca.
- **Se quita el visor de salas de Retro WFC** (`salas.mjs`): el multijugador va solo por nuestra página.
- **Dos PCs = dos juegos abiertos en el mismo PC** (así se probó BT3): basta con las pruebas de dos pestañas y una
  prueba a mano con dos ventanas.

### Etapa A — Cerrar lo de hoy y poner el trabajo a salvo
- ✅ A1. Terminar las pruebas: `prueba-copa.mjs` (copa offline de 4 carreras), modo Node recompilado +
  `prueba-arranque.mjs` (13 puntos), y ver por qué el navegador da 20 puntos si `CLAUDE.md` dice 21
- ✅ A2. Sitio: `npm run build` en `colabtex` (cambiaron `mkw.js` y `motor.js`) + `npm run test:juegos` + `mkw.test.cjs`
- ✅ A3. Papeles al día: este plan (marcar lo hecho), `docs/en-linea.md` (fases con su estado real), `CLAUDE.md`
- ⬜ A4. `subir-kit.sh` y commit en `claude/loving-planck-9k2yam` **solo con lo nuestro** (kit, sala de Mario Kart en
  `colabtex/src/juegos/`, pruebas, reglas de Firebase, `juegos-app.js` + `juegos.html`); afuera el trabajo ajeno, los
  cambios de solo fin de línea y los sellos de `i18n.js`
- ⬜ A5. Primer commit del repo local `MKW RETRO` (revisando `git status` contra `.gitignore`)
- ✅ A6. ~~Push de la rama y PR a `main`~~ → **sin PR ni push** (el dueño lo retiró). `main` se juntó en la rama local (conflictos de casino/Momazo/PRO DEFENDER resueltos dejando los dos, sellos regenerados)

### Etapa B — Publicación privada (jugar en el sitio de verdad)
- ✅ B1. Inventario exacto de lo que el Worker tiene que servir (lo que hoy sirve `servidor.mjs`): programa
  (`mkw.js`, `mkw.wasm.br` con `Content-Encoding: br` y huella `?v=`), manifiesto del disco, pedazos (HTTP Range) del
  disco y de `RetroRewind6/`, semillas (`pipelines.bin`, `bloques.json`), imágenes; CORS solo el sitio
- ✅ B2. Programa final (`compilar-web.py --modo navegador --final`) y semillas nuevas (`guion.mjs … --semilla`, 3 corridas):
  700 pipelines y 233 bloques (§65). Se recompila con `--final` antes de subir (el gancho de §66 cambió el programa)
- ✅ B3. Lista de archivos para R2 (disco 2,6 GB + RR 2,1 GB + programa 16 MB ≈ 4,7 GB) con huellas, y su
  comprobación; `docs/publicar.md` con los pasos del dueño (Worker, R2, `juegos/mkw/privado.json`, reglas de Firebase)
- ✅ B4. Banco: el Worker imitado en local con disco y RR **falsos** (403 a no-amigos, Range exacto, brotli, CORS)
- ✅ B5. Ensayo general en este PC (`sitio-local.mjs`, programa final, Worker de verdad): 1.ª visita 58,9 fps y 217 MB del
  Worker, 2.ª 60,0 fps, 99,5 % parejo y 6 MB (§67); la sala con dos pestañas, partidas y VR ya probados en `--sala` (§61–65)
- ✅ B5b. (Pedido del dueño) `jugar.bat` = la página de Juegos en este PC, solo con Mario Kart y su sala, de punta a
  punta (§69): emuladores de Firebase con las reglas del sitio, cuentas de mentira, el Worker de verdad, 1-3 ventanas
  de Chrome (= varios PC). `prueba-experiencia.mjs` 13/13. Encontró que la página no arrancaba en la dirección del
  sitio (`./banco/comun.js`): arreglado
- ✅ B6. Partidas en la nube (`nube.mjs`) con la sesión real del sitio: la sala pasa el Storage, el marco espera a la nube
  antes de leer sus partidas, sube al esconder la pestaña; regla de Storage en `firebase/storage.rules` (§65; `prueba-nube` 9/9)
- ⬜ B7. (Dueño) publicar Worker, subir a R2, poner la dirección, publicar reglas → prueba en el sitio real como amigo
  y como no-amigo

### Etapa M — El multijugador como lo pidió el dueño (2026-10-19; va primero: funciones antes que optimizar)
- ✅ M1. Abrir directo **por código** (sin cortina ni piloto): el juego cambia de sección con sus propias funciones
  (SectionMgr), elige o crea la licencia y registra el mando como el título (`directo_nativo.cpp`, `directo.mjs`, §71)
- ✅ M2. Un jugador directo: menú de inicio → menú «Un jugador» del juego en ~1 s (§71)
- ✅ M3. **Retro WFC directo por la página**: la sección en línea del juego, sus pantallas de confirmar con la acción
  de sus botones llamada directo, y el bucle del juego (elegir, votar, carrera, VR) por el WFC virtual de la sala
  (`prueba-enlinea` 9/9, §71). Investigación del bucle de Retro WFC en `docs/en-linea.md`
- ✅ M4. La sala del sitio con Retro WFC por defecto (sin CPU): crear sala → elegir modo **1) Retro WFC original ·
  2) Modo copa · 3) Modo playlist** (no «cuántas personas»); el vestíbulo elige carreras/pistas y cilindrada, y muestra
  la última tabla (`motor.js` `mkwPlaylist`/`mkwTabla`, `mkw.js`; `mkw.test` 16/16, §72)
- ✅ M5. Modo copa: N carreras con la cilindrada del anfitrión, puntos 15/12/10…, tabla final y vuelta al vestíbulo
  (`modos.mjs` + `modos_nativo.cpp`; banco `modos` 24/24, `prueba-modos` 9/9 con el juego, §72). Objetos: los del juego
- ✅ M6. Modo playlist: la cola sorteada por la sala; el voto de cada uno y la decisión del anfitrión pasan a ser la
  pista de la cola (`prueba-modos --playlist` 9/9 en la sala de las retro, §72). v2: editar la cola en el vestíbulo
- ✅ M7. 45 s antes de cada carrera para elegir personaje, kart y pista (el 30.0 del juego en 0x80899EF4 → 45.0, §72)
- ✅ M3b. Retro WFC entra a **la sala de las retro** como RR («Main modes» = Regional + VS de RR, región 0x0A); la
  Mundial de Pulsar es solo de pistas de Nintendo (§72.6)
- ⬜ M11. Qué hace la sala cuando un jugador se corta o el juego lo saca por inactividad (30 s sin tocar nada en la
  carrera, del juego original, §72.5): hoy el juego muestra su aviso y vuelve a su menú de Retro WFC
- ⬜ M8. Abrir directo lo que falta: las carreras de un jugador (Racedata + sección de carrera) y Multiplayer local
- ⬜ M9. (Si se puede exactamente) CPU iguales a las de un jugador en la sala; si no, se salta (el dueño)
- ⬜ M10. Después de M: el menú «cambiar Mii» con los 6 Mii invitados del juego y sus imágenes del juego

### Etapa C — En línea: terminarlo y endurecerlo
- ⬜ C1. Elegir personaje y vehículo en la sala para la carrera sincronizada (la página ya acepta `?pjs=`)
- 🟡 C2. Pruebas largas de "misma carrera": muchas copas sincronizadas con semillas y pistas al azar —
  `copas-al-azar.mjs` encontró una desincronización (cuadro ~6100 de la carrera 1, semilla 3549642503); con el reloj
  fijo en 0x80750AAC/0x807DC048 sigue (2 de 4 bien). En pausa: primero la etapa M
- ✅ C3. Red mala (latencia y pérdidas) en la carrera sincronizada con el juego: el retraso se adapta a la red (3 en
  esta PC, 6 con 70 ms de ida y 5 % perdido) y la carrera ya no va en cámara lenta (§70; banco 32/32, `prueba-sincro` 10/10)
- 🟡 C4. El cuelgue ocasional al empezar la carrera (`Effects::Player::UpdateNonItemEffects`, 1 de 6 corridas): no volvió
  a salir en 18 corridas (§70); queda la espera de la primera visita (bajar la pista con la caché vacía) → E2
- ✅ C5. PC lento en la sala (`prueba-sincro --lento`): la carrera sigue igual en las dos y va al ritmo de la lenta (por
  diseño, §62.3); ahora la página avisa quién frena («espera al jugador 2» / «Tu PC no alcanza») (§70.7; 11/11)
- ⬜ C6. VS en línea sin CPU: cola de pistas y «Confirmar» sobre la votación (F3); TURN, más jugadores, fallos en el chat (F4)
- ⬜ C7. Espectadores (video del anfitrión, como `bt3-directo.js`)
- ⬜ C8. Dónde guarda Pulsar `RRSettings.pul` (trofeos) y `RRRating.pul` (VR) en línea

### Etapa D — Página y modos
- ⬜ D1. Cilindrada (con 200cc de RR) y personaje en los modos de un jugador
- ⬜ D2. Imágenes sacadas del juego (fotos de pistas, íconos, caras de Mii) a R2 con el programa
- ✅ D3. Quitar el visor de salas de Retro WFC (§64); el código de amigo propio ya sale del `rksys.dat` (`licencias.mjs`)
- ⬜ D4. La ayuda de "tarjeta de video equivocada" en la página del sitio
- ✅ D5. (Pedido del dueño) sin portada: directo al juego; la cortina tapa la carga y los menús que recorre el piloto;
  escondidos «Retro WFC» (fuera de la sala en línea) y los «Settings» de Retro Rewind (§66; banco 11/11, `prueba-menus` 8/8)
- ✅ D6. (Pedido del dueño) menú de inicio «JloKart Wii» con su imagen, sin «Championship», **solo para los amigos** (la
  imagen sale del Worker con token + `AMIGOS`, como el disco de BT3; 401/403 = sin menú): Single Player → menú «Un jugador»
  del juego, Multiplayer → Local / Online (salas), Options → cajón; entrada «Mario Kart Wii · un jugador» (`#solo/mkw`) en
  el sitio (§67; banco 14/14, `prueba-inicio` 14/14, `mkw.test` 13/13)

### Etapa E — Rendimiento
- ⬜ E1. Sonido con AudioWorklet (latencia ~100–150 → ~30 ms) y sin cortes en el arranque
- ⬜ E2. Primera visita: los ~9 tirones por pipelines nuevos en 20 s
- ⬜ E3. Monitores de 60/120/240 Hz: recortar el giro final de 0,75 ms (medir con el monitor en 240 Hz)
- ⬜ E4. Celulares (cuando el dueño diga): teléfono real con `adb reverse`; misma carrera entre PC y teléfono (NaN en ARM)

### Etapa F — De fondo
- ✅ F1. Un script que corra todas las pruebas y diga "N bien, M mal": `herramientas/correr-todo.mjs` (§70)
- ⬜ F2. Banco que falta: disco y RR falsos, Worker local, juego falso chico
- ⬜ F3. Script para actualizar Retro Rewind (delta, retraducir `Code.pul`, recompilar, semillas, R2)
- ⬜ F4. Siempre: bitácora + glosario, `parches/` y `versiones.md` al día

**Terminado =** un amigo entra al sitio → Juegos → Mario Kart Wii → carga desde R2 por el Worker → juega a 60 fps;
sus partidas, récords y VR quedan en Firebase. Una sala de 2–12 corre (con CPU de relleno y ≤ 4 humanos, la carrera
sincronizada; si no, el VS en línea) sin separarse ni congelarse. Un no-amigo no ve el juego ni puede bajarlo. Nada
del juego en git ni público. Celular: actualización aparte.

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
  **Retro Rewind falso** (`RetroRewind6/` con la misma forma), para probar el Worker sin datos reales (etapas B4/F2)
- ⬜ **Worker local** (el Worker de amigos imitado en 127.0.0.1) con disco y RR falsos: 403 a no-amigos, Range, brotli, CORS (etapa B4)
- ⬜ **Juego falso**: un `.wasm` chico que imita los ganchos del de verdad (etapa F2; hoy las páginas se prueban con el juego
  de verdad en este PC)
- ✅ **Firebase y WebRTC falsos**: buzón por BroadcastChannel (`senal=canal`), Firebase falso que aplica las reglas
  (`nube` 23/0, `vr` 20/0, `records`), red falsa (`red` 20/0), sala falsa del sitio (`sala-mkw`); espectadores: etapa C7
- ✅ ~~Salas de Retro WFC falsas~~: ya no hacen falta, el visor de Retro WFC se quitó (§64)
- 🟡 **Controles simulados** (`banco/pruebas/controles/`, 28/0): mando falso (Gamepad API de mentira), teclas,
  toques de varios dedos (pointer events), inclinación falsa (`deviceorientation`), vibración. Falta: toques
  por CDP en un Pixel 7 vertical/horizontal y que ningún botón táctil choque con otro a ningún tamaño
- 🟡 Pruebas de Playwright: `node banco/correr.mjs` corre todas las páginas del banco (21/21) y `web/navegador/prueba-*.mjs`
  las del juego; falta un solo script que corra todo (etapa F1)

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
  - ⬜ Cortes en el arranque (2 huecos + bloques tirados mientras el juego se traba leyendo el disco) y latencia
    ~100–150 ms (bloque de 43 ms + cola de 60): AudioWorklet en vez del ScriptProcessorNode (etapa E1)
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
- ⬜ **El Worker de verdad** (el mismo de BT3, con su lista de amigos): entregar el programa como `servidor.mjs` (§54:
  `immutable` con `?v=`, `mkw.wasm.br` con `Content-Encoding: br`, `X-Mkw-Build` en el manifiesto). Lo prepara y
  publica el dueño; aquí se deja todo lo que necesita (etapa B)
- ⬜ **CPU del juego en equipos débiles**: medir en un teléfono real (Android con Chrome) cuando el dueño lo pida
  (etapa E4; la emulación con freno de Chrome exagera)
- ⬜ **Subir las semillas** (`pipelines.bin`, `bloques.json`) a R2 junto al `.wasm` y rehacerlas cuando cambie aurora o
  el disco (etapas B2/B3)
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

- ✅ Overlay de `RetroRewind6/` (pistas, personajes, música) por pedido igual que el disco: en local lo sirve
  `servidor.mjs`; en R2, etapa B
- 🟡 Ajustes de Pulsar: `RRGameSettings.pul` ya se guarda (NAND `shared2/Pulsar/RetroRewind6/`); `RRRating.pul` (VR) se
  lee (`licencias.mjs`); falta ver dónde caen `RRSettings.pul` (trofeos) y el VR al jugar en línea (etapa C8)
- ⬜ Actualizar a una versión nueva de RR = bajar el delta, retraducir `Code.pul`, recompilar, subir a R2 (script, etapa F3)

## Fase 5 — En el sitio (repo Paginita-Pro)

- ✅ `juegos/mkw/`: página propia con la cara del sitio (§55: inicio, modos, barra, cajón, «Tu partida», Mi Mii, piloto)
  y ✅ **integrada en `juegos.html` como juego de sala** (§60: marco, vestíbulo con CPU de relleno y hasta 12, manual,
  portada, reglas de Firebase, `mkw.js` + `motor.js`)
- ⬜ `.wasm` + archivos del disco y de RR en R2, servidos por el Worker solo a `AMIGOS` (etapa B; el dueño publica)
- ✅ Oculto salvo amigos (`ocultos.js` + `bt3-amigos.js`, como BT3); nada se baja desde el vestíbulo (§60)
- 🟡 **Partidas en la nube** (`web/navegador/nube.mjs`): el paquete `.mkwp` en Firebase Storage `mkw/<uid>/partidas.mkwp`
  con huella SHA-256 y hora de juego en los metadatos; al entrar sube, baja o no hace nada según las huellas; conflictos
  → gana la jugada más recientemente y la otra queda de respaldo; subida automática con espera y tope de frecuencia.
  Banco `pruebas/nube/` (Firebase falso con las reglas) **23/0**. Regla y código para la página en `docs/firebase-mkw.md`.
  ✅ Conectado con el inicio de sesión real del sitio (B6, §65: `prueba-nube` 9/9); ⬜ el dueño publica la regla de Storage
- ✅ Pruebas de la sala: `colabtex/tests/mkw.test.cjs` (12/12) y la sala falsa `banco/pruebas/sala-mkw` (`prueba-enlinea
  --sala`, `prueba-sincro --sala`)

## Fase 6 — En línea y social

- ✅ ~~Salas de Retro WFC en vivo~~ → **se quitó** (decisión del dueño, §64): el multijugador va solo por nuestra página.
  El código de amigo pasó a `codigo-amigo.mjs` y «Tu partida» lo sigue mostrando (sale del pid del `rksys.dat`)
- 🟡 Jugar en línea por la página: diseño "WFC virtual" en `docs/en-linea.md` (sockets de la Wii → JS, UDP por WebRTC, WFC chiquito en la pestaña del anfitrión, Firebase solo presenta). ✅ F0 sockets ✅ F1 WFC virtual (2 pestañas, 3 carreras seguidas, §58) ✅ F2 transporte (malla WebRTC + router, buzón intercambiable; probado con el juego y en `banco/pruebas/red`, §59) 🟡 F3 sala (✅ sala del sitio con vestíbulo, hasta 12, entrar con la carrera andando → el juego lo suma en la siguiente, §60; ✅ carrera sincronizada con CPU de relleno, §61–63; ⬜ cola de pistas tipo playlist y 45 s con «Confirmar» sobre la votación del juego: etapa C6) ⬜ F4 robustez (TURN, más jugadores, motivos de fallo en el chat: etapa C6)
- ⬜ Espectadores (`bt3-directo.js` adaptado a canvas WebGPU; etapa C7)
- ✅ **CPU de relleno en línea** (§61–63): con CPU de relleno y ≤ 4 humanos la sala corre la **carrera sincronizada**
  (todas las consolas corren la misma carrera offline con los botones de todos: lockstep); con más humanos, VS en línea
  sin CPU. Copa entera 4/4 con semilla y dentro de la sala falsa
- ✅ **VR/BR de cada jugador en Firebase** (pedido del dueño): `vr.mjs` → Realtime Database `mkw/vr/<uid>` (§60); el WFC
  se lo devuelve al juego al entrar (`/api/mkw_rr_ratings`), el espía de la pila lee lo que informa el juego tras cada
  carrera (§59). **Solo se mueve en línea** (decisión del dueño): la carrera sincronizada no lo toca. Falta: el dueño
  publica las reglas (`docs/firebase-mkw.md` §6)
- ✅ El multijugador va **solo por nuestra página** (§64: se quitó el visor de Retro WFC)

## Modos de la página (§55)

- ✅ Gran Premio (copa elegida) y Carrera (pista elegida) con el piloto, nombres de las pistas leídos del juego
- ✅ Mi Mii (base de Mii de la Wii, caras de partida); ⬜ fotos reales de las caras (sacadas del juego, a R2; etapa D2)
- ✅ Copa a tu gusto: 4 pistas elegidas, con su **semilla** (misma semilla = misma copa; §56)
- ✅ Contrarreloj (con o sin el mejor fantasma); ✅ CPU: dificultad o sin CPU; ⬜ cilindrada y personaje (etapa D1)
- ✅ Récords de tiempo por pista y cilindrada (§57; en Realtime Database desde §60)
- 🟡 Imágenes sacadas del juego para elegir (foto, plano y videíto de cada pista, ícono de cada copa): hechas en local
  (`sacar-imagenes.mjs`, `empaquetar-imagenes.mjs`; `prueba-elegir` 23/23 con paquetes falsos); a R2 con el `.wasm`,
  nunca a git (etapa D2)

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

- **2026-10-19 06:04** — **Los tres modos de la sala: Retro WFC, copa y playlist, con 45 s para elegir** (§72; M4–M7). Pedido del dueño: con Retro WFC por la página, separarlo en 3 modos (el original, copa y playlist), crear sala = elegir el modo, y 45 s antes de cada carrera. Los tres son el modo en línea del juego; la página cambia: el reloj (el 30.0 de 0x80899EF4 → 45.0), la decisión del anfitrión (`modos_nativo.cpp` envuelve DecideTrack/DecideCC de Pulsar y SetPlayerData: pista de la cola y cilindrada) y el fin (`modos.mjs` cuenta carreras, suma puntos, tabla final, `{tipo:"fin",tabla}` al sitio, que vuelve al vestíbulo con «Última copa»). Dos hallazgos: (1) **el corte a los 30 s de carrera** era el control de inactividad del juego original (0x8053F184: 1800 cuadros sin tocar un botón → DisconnectMgr corta); una persona que maneja no lo ve; las pruebas terminan la carrera por código (`mkw_modos_terminar` → EndLap hasta la meta). (2) **Entrábamos a la sala equivocada**: la Mundial de Pulsar es solo de pistas de Nintendo (por eso la playlist con una retro se colgaba); ahora Retro WFC entra como RR, «Main modes» = Regional (0x8064BDC4) + VS de RR (`rr_kamek_8183FCC0`, región 0x0A, las retro); `?wfc=mundial` = la de antes. Pruebas: banco `modos` **24/24**, `directo` **18/18**; sitio 47/47; con el juego `prueba-modos` **9/9** (copa, pista retro 0x100 a 100cc), `--playlist` **9/9** (0x136 en espejo), `prueba-enlinea` **9/9**. Falta (M11): qué hace la sala cuando alguien se corta; v2 de la playlist: editar la cola.
- **2026-10-19 03:56** — **Abrir directo por código y Retro WFC por la página** (§71; etapa M nueva con los pedidos del dueño). El dueño: «saltar la interfaz» = abrir la pantalla con el código del juego, no cortina + piloto; el multijugador sincronizado estaba mal (todos los karts eran CPU: cámara de espectador, bots sin rival); «si no se puede con los mismos CPU, implementa el Retro WFC modificado para la página» y después 3 modos. Hecho: `directo_nativo.cpp` envuelve `SectionMgr::Update` de RR (`rr_overlay_8063550C`) y hace lo que el juego: registra el mando (Input::Manager +0x3BA0), elige o crea la licencia (0x805EB7A0 / CreateLicense) y SetNextSection + RequestSceneChange; la acción de botones del juego llamada directo (lista corta, página activa). Un jugador abre directo (~1 s). Retro WFC: sección 0x55 directa, aviso de datos → Siguiente, «¿Conectarse?» → Sí, cartel de bienvenida → cerrar, Mundial; el juego busca, elige, vota y corre solo por el WFC virtual: `prueba-enlinea` **9/9** (carrera en línea a los 164 s). Banco `directo` **16/16**. Investigación del bucle de Retro WFC en `docs/en-linea.md`. Mii invitados: después del multijugador (dueño).
- **2026-10-18 23:58** — **Una PC lenta en la sala (C5) y el aviso de quién frena** (§70.7). `prueba-sincro --lento` (B con la CPU frenada 2×): la carrera sigue siendo la misma (10–11 huellas iguales) y va al ritmo de B (~30 cuadros/s; A espera ~20 ms por cuadro), como se diseñó en §62.3. Nuevo: `lockstep.mjs` anota a quién se esperó (`esperaDe`) y `avisoLento`/`vigiaLento` avisan sobre el juego «La carrera va a 28 cuadros por segundo: espera al jugador 2 de la sala» y, en la lenta, «Tu PC no alcanza 60 cuadros por segundo», solo con 6 s seguidos lentos (un tirón de la largada con la caché vacía ya había dado un aviso falso). Banco `lockstep` **35/35**; `prueba-sincro` normal **11/11** dos veces (sin avisos) y `--lento` **11/11**. Los nombres de los jugadores en el aviso quedan para C6 (la página solo recibe los uid de la sala).
- **2026-10-18 23:33** — **El retraso de la carrera sincronizada se adapta a la red (C3), la planilla de todas las pruebas (F1) y C4 sin repetirse** (§70). `lockstep.mjs`: pings cada 0,5 s a cada jugador; el decisor (el primer humano que sigue) anuncia al empezar cada carrera cuántos cuadros de retraso usar (3 a 8), uno solo y el mismo para todos (quien lo recibe lo reenvía); se calcula con las últimas 16 idas y vueltas sin contar los tirones (más de 100 ms sobre la más rápida: una pestaña cargando) y con un cuadro de más si se perdió alguna. `?redMala=lat,var,pérdida` (`malla.mjs`, solo pruebas) y `?retraso=fijo` (el de antes). Con el juego (`prueba-sincro`): red de esta PC → **3** cuadros, espera 0,00 ms; red mala 70±10 ms y 5 % perdido → **6**, espera 0,14/0,22 ms (10/10); la misma red con el retraso fijo → 9,4/11,2 ms por cuadro, cámara lenta (9/10). Banco `lockstep` **32/32** (3 veces seguidas: red lenta, anuncio reenviado, pestaña trabada al cargar), `red` 25/25. Primer intento malo (corregido): anunciaba durante la carga y daba 8 en esta misma PC. `herramientas/correr-todo.mjs` (`--sin-juego`, `--solo`, `--repetir N`, `--lista`): rápidas 64/0. C4: 18 corridas sin el cuelgue; la única espera larga (684 ms) fue la pista bajando con la caché vacía.
- **2026-10-18 23:05** — **`jugar.bat`: la página de Juegos en este PC, solo con Mario Kart, de punta a punta** (§69). Pedido del dueño: un .bat que abra el menú de la página mostrando solo MKW y MKW en línea, para probar la experiencia entera; se descartó un artifact (el juego no puede subirse y un artifact no alcanza 127.0.0.1). `herramientas/experiencia.mjs`: emuladores de Firebase (cuentas, base, Storage) con las reglas del sitio, cuentas de mentira (Piloto Uno/Dos/Tres amigos, Intruso no), `sitio-local --emuladores --solo mkw --amigos` con el Worker de verdad (`worker-local --emulador` re-firma los tokens del emulador) y 1-3 ventanas de Chrome, cada una con su perfil. En el sitio: `firebase.js` (emuladores) y `juegos-main.js` (catálogo solo MKW) solo en 127.0.0.1, con prueba (`mkw.test` 14/14). `prueba-experiencia.mjs` **13/13**: invitado sin nada, entrar con la ventanita del emulador, catálogo solo MKW, «un jugador» con el menú JloKart (imagen 200 por el Worker), Single Player → 0x69, partida subida a Storage, Multiplayer → Online → ficha, sala con Piloto Dos, Intruso bloqueado en todo, «¡A correr!» y los dos en la misma carrera (huellas iguales). **Error real encontrado**: en el sitio la página está en `juegos/mkw/web/navegador/` y `mkw.mjs` importaba `./banco/comun.js` (404: el juego no arrancaba ni en la sala ni en «un jugador»); ahora `./verificaciones.mjs`, y `sitio-local` ya no tiene el atajo `/juegos/mkw/` que lo escondía. `prueba-inicio` 14/14 con la ruta nueva. El .bat probado de verdad (pregunta, 1 ventana a los 15 s, «Listo», Chrome con su perfil); `chcp 65001` va primero o cmd se desfasa con los acentos.
- **2026-10-18 22:30** — **Menú de inicio «JloKart Wii», solo para amigos, y ensayo general B5** (§67). La imagen del dueño sin los botones pintados (`preparar-inicio.py`), privada (Worker + lista AMIGOS; nunca a git), con 3 botones propios sin «Championship»; Single Player → menú «Un jugador» del juego, Multiplayer → Local/Online, Options → cajón; teclado, mandos, mouse y toque. Banco `inicio` 14/14, `prueba-inicio` 14/14, sitio `#solo/mkw` (`crearMkwSolo`). B5: 1.ª visita 58,9 fps / 217 MB, 2.ª 60,0 fps / 99,5 % parejo / 6 MB.
- **2026-10-18 22:21** — **La cortina del rescate tapa toda la imagen en la página** (§68). El dueño la vio tapar solo una parte ("por el stretch"): es el aspecto dinámico de WiiCompiled en una ventana más ancha que 16:9 (el programa de Windows); la página no estira nunca (canvas fijo 854×480, `object-fit: contain`). `prueba-caida` con 5.º punto (bordes de la imagen en el negro) y `--ancho/--alto`: ventana 960×792 **5/5** y 1800×760 **5/5**.
- **2026-10-18 22:09** — **La pantalla negra al caer del mapa es del juego** (§68). Nuevo diagnóstico `prueba-caida.mjs` (Contrarreloj en SNES Rainbow Road, maneja solo hasta caerse; graba el screencast de Chrome y el contador de cuadros del juego): 3 rescates de Lakitu, cada uno ~2,0 s oscuro (cortina de rayas que se cierra en ~0,4 s, ~1,5 s en negro, se abre) con el juego a 60 cuadros/s todo el rato y la misma duración en los tres: es la transición original, no un tirón del port. **4/4**. El dueño decidió dejarla como en el original.
- **2026-10-18 19:50** — **Plan del dueño guardado y etapa A** (§64). El dueño contestó: commits, push y PR sí (merge cuando él diga); mismo Worker y lista de amigos que BT3, el Worker y R2 los publica él; el VR solo se mueve en línea; fuera el visor de salas de Retro WFC; "dos PCs" = dos ventanas. Se quitó `salas.mjs` (el código de amigo pasó a `codigo-amigo.mjs`, con 5 puntos nuevos en el banco de licencias: 26/26). Las reglas de la sala del sitio dicen ahora que la copa con CPU no mueve el VR. Arreglo: la carrera 4 de la copa a tu gusto salía a veces sin su semilla (la página la borraba antes de que el juego preparara la carrera; lo destapó §63): `prueba-copa` **11/11**. Todo verde: banco 21/21, Node 13/13, navegador 20/20, partidas 6/6, piloto 9/9, elegir 23/23, sincro 9/9 (y `--sala`), copas sincronizadas 4/4 y 4/4, en línea 9/9, sitio 885/893 (las 8 de siempre, ajenas) y `mkw.test` 10/10.
- **2026-10-18 18:00** — **En línea, la página ya no se congela** (§63). Sin enganche al monitor (`?red`: la carrera sincronizada y el VS por el WFC de la sala) el runtime esperaba cada cuadro girando sin soltar el hilo: la página respiraba solo cuando el lockstep esperaba a la otra consola (huecos de 120-700 ms) y, al terminar la carrera, nunca más (la copa no pasaba a la carrera 2). Ahora `vi.cpp` cede por reloj (`mkwEsperaReloj`) y la pausa de presentar de aurora va también en línea: copa sincronizada **4/4** (con semilla) y **4/4** dentro de la sala falsa del sitio, carrera 2 en las dos con las huellas iguales; una pestaña en línea igual de pareja que sin red (34,8 % de refrescos con cuadro nuevo, 0 % saltados, 60 cuadros/s). Y una optimización que salió de ahí: en monitores que no se pueden enganchar (144/165/175 Hz) y en línea, la espera despierta al juego en el vencimiento sin girar 1,5 ms: leer el reloj bajó de ~8 % a ~0,5 % del tiempo de la pestaña (~1,7 ms por cuadro menos de procesador quemado; hilo ocupado 41–47 % en vez de 46–52 %), con la pantalla igual de pareja (0 % saltados). Nueva herramienta `herramientas/medir-enlinea.mjs`. Pruebas más firmes: tope de 10 s por lectura en `prueba-sincro`, `autoconducir` en la sala falsa, `prueba-enlinea` con el build de siempre, banco 21/21 (el del sonido aprieta su botón).
- **2026-10-18 14:50** — **La carrera sincronizada ya no se separa** (§62). Dos desincronizaciones escondidas que salían 3 de cada 4 veces con la semilla de una sala real: (1) la «compensación de lag» de Retro Rewind (`rr_kamek_81806568`) se saltaba el dibujo de cuadros según la carga de cada PC, y el dibujo copia la posición de los karts a sus modelos (que lee la IA): en la sala con CPU ahora se dibuja siempre; (2) el reloj fijo del sorteo era un contador para todo el juego: ahora es **por lugar** (`PPC_MftbCarreraEn(sitio, lr)`). Misma carrera 2 veces: **4/4 idénticas** (antes 1/4). La sala del sitio elige la carrera sincronizada (CPU de relleno y ≤ 4 humanos), fin de carrera cuando llegan todos los humanos, vista propia de sonido y HUD, carrera 2 de la copa aunque el Raceinfo quede en la misma dirección, `jugar.bat`. Herramientas: punto de vigilancia (`-DMKW_VIGIA`, `--carpeta build/web-vigia`).
- **2026-10-18 01:50** — **Sala con CPU de relleno: la carrera sincronizada funciona** (§61). Lockstep: todas las consolas corren la misma carrera VS offline (12 karts, humanos + CPU) con los botones de todos (`lockstep.mjs`, `pad_web.cpp`, `semillas_nativo.cpp`, `lockstep_nativo.cpp`, `PPC_MftbCarrera`). La desincronización era la tabla de pantallas de Racedata: ahora igual en todas, y solo cámara y HUD van al kart propio. Corte en dos pasos cuando alguien se va (error real hallado por el banco nuevo `banco/pruebas/lockstep` 25/25); 45 s de espera a quien no llegó. `prueba-sincro.mjs` **9/9** (15/15 huellas iguales). Piloto: toques contados en cuadros, corrige el modo, y **solo Esc** lo detiene (el aviso del sonido hacía que cualquier tecla lo parara: bug que vio el dueño). PC 60 fps, 9 ms (+1 ms por explicar). Celular: para una versión futura.
- **2026-10-17 20:55** — **La sala del sitio** (§60): Mario Kart Wii como juego de sala en la copia del sitio (motor `redMkw`, cartero `mkw.js`, vestíbulo con VR y CPU de relleno, privado como BT3, manual, portada, reglas de Firebase con tope 12 y nodo `mkw`, `tests/mkw.test.cjs`); VR y récords pasados a Realtime Database (el sitio no usa Firestore); el piloto entra solo en línea (`?modo=enlinea`) con vigilante de búsqueda; `prueba-enlinea.mjs` 8/9 corridas bien y `--sala` 11/11.
- **2026-10-17 20:15** — **Malla WebRTC, banco de la red y VR en Firebase** (§59). `malla.mjs` + `crearRouterMalla` (F2) probados con el juego entre dos pestañas; `banco/pruebas/red` 20/20 (destapó y arregló una pérdida de bytes en la pila); el VR: Retro Rewind lo pregunta con `/api/mkw_rr_ratings` (formato `{"found":1,"vr":…}`, averiguado en su código) y lo informa por GPCM; `vr.mjs` lo guarda en Firestore `mkw_vr/{uid}` y se lo devuelve al juego al entrar (probado: el juego guardó 7.777); `banco/pruebas/vr` 20/20; «Tu partida» muestra el VR de RR.
- **2026-10-17 19:20** — **En línea funcionando entre dos pestañas** (§58). Sockets del juego hacia la página (`web/red/red_web.cpp`, esperas con JSPI), pila de red propia (`red.mjs`), y un WFC escrito por nosotros dentro de la pestaña anfitriona (`wfc.mjs`, `wfc-salas.mjs`: NAS, GPCM, QR2, lista de salas cifrada con enctypeX, NATNEG, SAKE, API de RR). Dos pestañas se encuentran, pasan por la sala y corren viéndose (~36 paquetes/s, 0 perdidos); sin "enganche" en modo red para que no se desfasen. La "desconexión a los 34 s" era el **anti-AFK** del juego (encontrado con ganchos de depuración `MKW_DEPURAR=1` y un osciloscopio de memoria). Perfil fijo por consola (sin error 60000 al volver a entrar). 3 carreras seguidas con resultados, salida por AFK y reingreso. Pendiente: CPU de relleno en línea, VR en Firebase, salas como BT3 (Firebase + WebRTC), sala de la página conectada al juego.

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
