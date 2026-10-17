# Parches a proyectos de terceros

Los proyectos de `terceros/` se bajan tal cual (commit fijado en `herramientas/versiones.md`) y nuestros cambios
viven aquí como diffs, para poder rehacerlos sobre una versión nueva.

| Parche | Sobre | Qué hace |
|---|---|---|
| `runtime-web.diff` | `terceros/Wiicompiled` | Todo lo que el runtime necesita para wasm: cabeceras (NEON imitado en `ppc_isa_wasm_neon.h`, FPU sin registro de control, memoria siempre comprobada incluido `FlatWriteRam*`, `MkwFma`/`MkwFms` exactas con NaN de x86), memoria con bloques normales (`guest_flat_memory_wasm.cpp`), hilos del juego con JSPI (`host_context.cpp`), esperas que ceden al navegador (`vi.cpp`), disco sin `realpath` y leído por la página en el navegador (`dvd.cpp`, `dvd_contract.h`), NAND sin enlaces duros (`nand_settings.h`, `nand_api.cpp`), contador de cuadros y reloj VI enganchado al refresco del monitor (`vi.cpp`), medidor de la cola de sonido y ajuste fino del ritmo para el navegador (`audio_backend.cpp`/`.h`), `main.cpp` sin manejadores de escritorio. Ver `docs/bitacora.md` §15–21, §28–29, §33 y §36 |
| `aurora-web.diff` | `terceros/Wiicompiled` (`aurora-main/`) | aurora con el WebGPU del navegador: superficie en el `<canvas>`, sin hilos, sin `Present()`, esperas que ceden (JSPI), sin caché de shaders en disco, preferencia de tarjeta elegida por la página, pipelines pedidos en segundo plano (el dibujo se salta hasta que llegan), lista de pipelines usados para precalentarlos al arrancar (`pipeline_cache.cpp`, `gx.cpp`, `common.cpp`), búfer de preparación plano con `Queue::WriteBuffer` de lo usado en vez de mapear 37 MB por cuadro (`common.cpp`) pausa de presentar sin giro que cede hasta que el navegador tomó el canvas (`Module.mkwEsperaToma`) y, antes de tomar la textura del canvas, deja correr la actualización de la pantalla atrasada o espera el refresco del compás (`Module.mkwTomaAtrasada`/`mkwEsperaAtrasada`) (`aurora.cpp`). Todo dentro de `#ifdef __EMSCRIPTEN__`. Ver `docs/bitacora.md` §26, §29, §51, §53 y §54 |
| `imgui-web.diff` | `terceros/deps-aurora/imgui` | Permite la opción "Dawn" de imgui al compilar para la web (con emdawnwebgpu la API es la de Dawn). Ver §25 |

Aplicar (desde la raíz del proyecto):

```powershell
git -C terceros\Wiicompiled apply ..\..\parches\runtime-web.diff
git -C terceros\Wiicompiled apply ..\..\parches\aurora-web.diff
git -C terceros\deps-aurora\imgui apply ..\..\..\parches\imgui-web.diff
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
