# Parches a proyectos de terceros

Los proyectos de `terceros/` se bajan tal cual (commit fijado en `herramientas/versiones.md`) y nuestros cambios
viven aquí como diffs, para poder rehacerlos sobre una versión nueva.

| Parche | Sobre | Qué hace |
|---|---|---|
| `runtime-web.diff` | `terceros/Wiicompiled` | Todo lo que el runtime necesita para wasm: cabeceras (NEON imitado en `ppc_isa_wasm_neon.h`, FPU sin registro de control, memoria siempre comprobada incluido `FlatWriteRam*`, `MkwFma`/`MkwFms` exactas con NaN de x86), memoria con bloques normales (`guest_flat_memory_wasm.cpp`), hilos del juego con JSPI (`host_context.cpp`), esperas que ceden al navegador (`vi.cpp`; también sin enganche al monitor, en línea: §63), disco sin `realpath` y leído por la página en el navegador (`dvd.cpp`, `dvd_contract.h`), NAND sin enlaces duros (`nand_settings.h`, `nand_api.cpp`), contador de cuadros y reloj VI enganchado al refresco del monitor (`vi.cpp`), medidor de la cola de sonido y ajuste fino del ritmo para el navegador, y el sonido entregado al AudioWorklet de la página (SDL3 solo convierte, sin su ScriptProcessorNode) con el clic de prueba para medir la demora (`audio_backend.cpp`/`.h`), `main.cpp` sin manejadores de escritorio, la red del juego hacia la página (`network_core.cpp`, `network_deferred.cpp`, `network_ssl.cpp`: sockets propios y TLS con el WFC de la sala) y el reloj de la carrera sincronizada (`ppc_helpers.cpp`: `PPC_MftbCarrera` y el reloj por lugar `PPC_MftbCarreraEn`; `os_time.cpp`: la hora del juego por cuadros) y el punto de vigilancia para depurar (`memory_access.h`, solo con `-DMKW_VIGIA`). Ver `docs/bitacora.md` §15–21, §28–29, §33, §36, §58, §61, §62, §63 y §88 |
| `aurora-web.diff` | `terceros/Wiicompiled` (`aurora-main/`) | aurora con el WebGPU del navegador: superficie en el `<canvas>`, sin hilos, sin `Present()`, esperas que ceden (JSPI), sin caché de shaders en disco, preferencia de tarjeta elegida por la página, pipelines pedidos en segundo plano (el dibujo se salta hasta que llegan), lista de pipelines usados para precalentarlos al arrancar (`pipeline_cache.cpp`, `gx.cpp`, `common.cpp`), búfer de preparación plano con `Queue::WriteBuffer` de lo usado en vez de mapear 37 MB por cuadro (`common.cpp`) pausa de presentar sin giro que cede hasta que el navegador tomó el canvas (`Module.mkwEsperaToma`) y, antes de tomar la textura del canvas, deja correr la actualización de la pantalla atrasada o espera el refresco del compás (`Module.mkwTomaAtrasada`/`mkwEsperaAtrasada`) (`aurora.cpp`). Todo dentro de `#ifdef __EMSCRIPTEN__`. Ver `docs/bitacora.md` §26, §29, §51, §53 y §54 |
| `runtime-web-v093.diff` | WiiCompiled v0.9.3 (`0d5c402`, `terceros/Wiicompiled-motor`) | Lo mismo que `runtime-web.diff`, rehecho sobre el runtime v0.9.3 (el código de memoria se mudó a `runtime/include/guest_abi/`), más: el hilo de GX de la v0.9.3 apagado en wasm (`gx_worker.h`: `Active/OnWorker/ShouldDefer` falsos fijos; `gx_worker.cpp`: `Start()` no lo arranca, `Header` alineado a 8 para wasm32). Ver §170 |
| `aurora-n15a.diff` | nuestra aurora (`aurora-main` de `bd219e3` + `aurora-web.diff`), sus rutas sin `aurora-main/` | Lo que el runtime v0.9.3 pide a la aurora (el adaptador: `aurora_begin_frame_window/_gx`, `aurora_end_frame_window/_gx`, `aurora_get_window`, `aurora_enable_vsync`, `AuroraSetGxProducerThread`, `vsync`/`startHidden` en `AuroraConfig`; `render_size_limits.hpp` de la aurora nueva) y los arreglos cortos de dibujo de la v0.9.3: #376 (índices de matriz a 6 bits), #303 (colores constantes sin fuente = 0) y #348 (texgen sin configurar, etapa indirecta y relieve fuera de rango), detrás de `MKW_AURORA_ARREGLOS_V093` (`-DMKW_AURORA_ARREGLOS_V093=0` = como antes). Ver §170 |
| `motor-w19.diff` | `terceros/Wiicompiled-motor` (encima de `8165125`) | W19 de la etapa 0 (§195): el casillero del memo de las llamadas indirectas con los bits ALTOS del hash de Fibonacci (`runtime/include/guest_abi/dispatch.h`, `IndirectDispatchCacheIndex`; `-DMKW_MOTOR_MEMO_ALTO=0` = el de antes). Adaptado de KartPad `20ad85d` (Chris Sotraidis, GPL‑3.0; ver `herramientas/versiones.md`) |
| `motor-w6.diff` | `terceros/Wiicompiled-motor` | W6 de la etapa 0 (§197), solo para medir: dar vuelta los bytes «a mano» (sin la instrucción `bswap`/`movbe`) en el programa de Windows, con `-DMKW_BYTES_LENTOS` (`compilar-nativo.py --bytes-lentos`); en wasm no cambia nada |
| `aurora-e0.diff` | `terceros/aurora-main-viejo-motor` (encima de `5aa3fca`) | Tres interruptores apagados por omisión: W20 (§204) soltar las texturas de copia de repuesto ociosas 300 cuadros (`lib/dolphin/gx/GXFrameBuffer.cpp`, `mkw_web_piscina`, la página con `?piscina=1`; adaptado de KartPad `0cca4d2`, solo la piscina), W9 (§205) las matrices de los huesos leídas por filas, el camino de reserva para las Adreno 6xx/7xx (`lib/gx/shader.cpp`, `mkw_web_huesos_filas`, `?huesosFilas=1`) y W8 (§203) soltar los pipelines de las otras pistas al entrar a una (`lib/gfx/pipeline_cache.cpp/.hpp`, `mkw_web_pipelines_soltar`, `?soltarPipelines=1`, y `=2` = además vaciar la memoria de sombreadores compilados, lo que de verdad crecía; la época `g_mkwPipelinesEpoca` invalida la memoria config → pipeline de `lib/gx/command_processor.cpp`); más el contador de texturas vivas (`lib/gfx/texture.hpp/.cpp`, `mkw_web_texturas_dato`, solo cuenta). Regenerar: `git -C terceros/aurora-main-viejo-motor diff > parches/aurora-e0.diff` |
| `imgui-web.diff` | `terceros/deps-aurora/imgui` | Permite la opción "Dawn" de imgui al compilar para la web (con emdawnwebgpu la API es la de Dawn). Ver §25 |

Aplicar (desde la raíz del proyecto):

```powershell
git -C terceros\Wiicompiled apply ..\..\parches\runtime-web.diff
git -C terceros\Wiicompiled apply ..\..\parches\aurora-web.diff
git -C terceros\deps-aurora\imgui apply ..\..\..\parches\imgui-web.diff
```

Con WiiCompiled v0.9.3 (N15a, §170), en Git Bash desde la raíz:

```bash
git clone https://github.com/patchzyy/Wiicompiled terceros/Wiicompiled-motor && git -C terceros/Wiicompiled-motor checkout 0d5c402
git -C terceros/Wiicompiled-motor apply ../../parches/runtime-web-v093.diff
# la aurora: la nuestra (la de bd219e3 con aurora-web.diff) copiada aparte, sin el prefijo aurora-main/
cp -r terceros/Wiicompiled/aurora-main terceros/aurora-main-viejo-motor
git -C terceros/aurora-main-viejo-motor init -q && git -C terceros/aurora-main-viejo-motor apply ../../parches/aurora-n15a.diff
MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor python herramientas/compilar-web.py --modo navegador --carpeta build/web-motor
```

(`terceros\deps-aurora` lo crea `bash herramientas/bajar-deps-aurora.sh`; no es un repo de git, pero `git apply`
funciona igual en una carpeta común.)

Regenerar después de cambiar algo en `terceros/Wiicompiled/runtime` (en Git Bash, desde `terceros/Wiicompiled`):

```bash
{ git diff -- runtime; for f in runtime/include/isa/ppc_isa_wasm_neon.h runtime/src/guest_flat_memory_wasm.cpp; do git diff --no-index -- /dev/null "$f"; done; } | sed 's#^diff --git a/dev/null b/runtime#diff --git a/runtime#; s#^--- a/dev/null#--- /dev/null#' > ../../parches/runtime-web.diff
```

Si otra sesión tiene cambios a medio hacer en otro archivo del runtime (p. ej. `vi.cpp`), no regenerar todo: cambiar
solo la sección del archivo propio dentro del diff (cada sección empieza con `diff --git a/<ruta>`) y comprobar con
`git apply --check` sobre una copia limpia (`git archive HEAD runtime`).

El decodificador THP nativo (`web/thp/`) NO es un parche: es código nuestro (en git) que reemplaza a la función
traducida al compilar (`compilar-web.py`, `REEMPLAZOS`).

aurora (también en Git Bash, desde `terceros/Wiicompiled`):

```bash
git diff -- aurora-main > ../../parches/aurora-web.diff
```
