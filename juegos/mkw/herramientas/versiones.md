# Versiones fijadas

Un commit fijo + nuestros parches = un resultado reproducible (como `COMMIT` en `construir.sh` de BT3).

**E6 / P5 (2026-11-06, en validación):** `parches/motor-p5.diff` contiene únicamente
`runtime/src/audio_backend.cpp` sobre `terceros/Wiicompiled-motor-h6` rama `e2-w10`, commit `f7181fe`.
Una llamada JS por entrega trae también el nivel y objetivo de sonido. Parche regenerado y comprobado con
`git -C terceros/Wiicompiled-motor-h6 apply --reverse --check ../../parches/motor-p5.diff`.
El candidato final con PGO está en `build/web-e6`; no implica publicación ni cierre de E6 (bitácora §237).

| Cosa | Versión | Notas |
|---|---|---|
| WiiCompiled | `patchzyy/Wiicompiled` @ `bd219e38a3e9a1a5047ce41d8cd01210bef3af43` (2026-10-09) | GPL‑3.0; clon en `terceros/Wiicompiled` |
| WiiCompiled v0.9.3 (N15a, bitácora §170) | `patchzyy/Wiicompiled` @ `0d5c402d0366640a294bf9c699068299591f7eff` (2026-10-29, v0.9.3 + #376) | copia aparte `terceros/Wiicompiled-motor` (el traductor y el runtime nuevos); parches `parches/runtime-web-v093.diff`. **El paso 6 encima** (§182): en `terceros/Wiicompiled-motor` (rama `motor-n15`) el commit `8165125` = `parches/motor-paso6-v093.diff` (el `motor-paso6.diff` es el de la base vieja). **Orden para rehacerla desde un clon limpio de `0d5c402`**: `git apply parches/runtime-web-v093.diff` → (commit) → `git apply parches/motor-paso6-v093.diff` (crea `runtime/include/mkw_motor.h`); la aurora aparte, como dice arriba (M1, M2 y la vuelta de 8 bytes; `runtime/include/mkw_motor.h`); M8 queda aparte en `terceros/Wiicompiled-motor-m8` (`parches/traductor-m8.diff`, no adoptado); las otras pasadas de M8 (§193, ninguna adoptada), cada una sobre `8165125`: `terceros/Wiicompiled-motor-hojas` (`e176bb3` = `parches/traductor-m8-hojas.diff`), `-memo` (`069bdb8` = `parches/motor-m8-memo.diff`), `-banderas` (el techo, `41cd045`…`9e72852`) y `-seguro` (`3796636` = `parches/traductor-m8-banderas.diff`, con el techo y el seguro v2 de §193.1). **La aurora sigue siendo la nuestra** (la de `bd219e3` + `aurora-web.diff` + `parches/aurora-n15a.diff`: el adaptador de 10 funciones y los arreglos cortos de dibujo), en `terceros/aurora-main-viejo-motor`; la aurora nueva (submódulo `aurora-wiicompiled` @ `33067e34a17ca680eb961d9e0f3d48ddb22a7d7f`) queda para N15b. **Rehacer `terceros/aurora-main-viejo-motor`** (comprobado el 2026-10-31 tras §174, idéntica salvo finales de línea): la `aurora-main` de WiiCompiled @ `bd219e3` + `parches/aurora-web.diff` (desde la carpeta de WiiCompiled; trae C2 de §174 y `render_size_limits.hpp`) + `parches/aurora-n15a.diff` aplicado dentro de `aurora-main` **sin** `include/aurora/render_size_limits.hpp` (ya lo puso el anterior, igual): `git apply --directory=aurora-main --exclude='aurora-main/include/aurora/render_size_limits.hpp' parches/aurora-n15a.diff`. En la copia, los commits locales `e8515f2` (aurora-web.diff) → `b2a883d`/`92642dc` (n15a) → `9103edd` (C2 de §174, que en los parches va dentro de aurora-web.diff) → `518ed3d` (G2 de §177.2, también dentro de aurora-web.diff: el `lib/gfx/common.cpp` de las dos auroras queda idéntico) → `2a99260` + `5aa3fca` (G3/H12 de §181, los anillos de subida, también dentro de aurora-web.diff; prendidos por omisión, `MKW_ANILLO=0` los apaga: `common.cpp`/`common.hpp` siguen idénticos en las dos auroras) |
| KartPad (código adaptado en la etapa 0 del plan v4) | `chrissotraidis/wiicompiled` (Chris Sotraidis, https://github.com/chrissotraidis/wiicompiled, GPL‑3.0): **W19** `20ad85d956038365bd584c01a4bcf37e2cf02eea` (el índice del memo de las llamadas indirectas con los bits altos del hash; lo encontró DriftDroid) → `parches/motor-w19.diff` (en `terceros/Wiicompiled-motor`, `runtime/include/guest_abi/dispatch.h`, `MKW_MOTOR_MEMO_ALTO`); **W20** `0cca4d2ce8b07fb6d7e83e5c3aa1d2954cd4ca40` (solo la parte de la piscina: soltar las texturas de copia de repuesto ociosas 300 cuadros) → `parches/aurora-e0.diff` (en `terceros/aurora-main-viejo-motor`, `lib/dolphin/gx/GXFrameBuffer.cpp`, `?piscina=1`) | lo derivado es GPL‑3.0, como el resto del runtime adaptado. `parches/aurora-e0.diff` trae también W9 (`lib/gx/shader.cpp`, las matrices de los huesos por filas, `?huesosFilas=1`: propio, idea de KartPad `a1db7a3`/`fa8ee6b` sin su código) |
| N8 (etapa E3 del plan v4, bitácora §219) | propio | `parches/aurora-n8.diff` = solo `lib/aurora.cpp` de `terceros/aurora-main-viejo-motor` (encima de `5aa3fca` + `parches/aurora-e0.diff`): guardar la última imagen real de cada cuadro dibujado y mostrarla en el cuadro saltado, el plazo de cada imagen de entre medio desde la real, el «a compás» medido por aurora; todo dentro de `#ifdef __EMSCRIPTEN__` y apagado mientras el juego no llame `aurora_mkw_n8(1)` (`?n8=2`) |
| G12 (etapa 7, bitácora §253) | propio | `parches/aurora-g12.diff` = solo `lib/gfx/texture.cpp` de `terceros/aurora-main-viejo-motor` (encima de `parches/aurora-e0.diff` y `parches/aurora-w26.diff`): `new_static_texture_2d` salta los K niveles de detalle más grandes de las texturas estáticas con mips (no tlut, no mips arbitrarios, nunca menos de 4×4) y `mkw_web_texturas_menos(k)` / `_dato`; con k = 0 (lo de omisión) no cambia nada |
| WheelWizard | `TeamWheelWizard/WheelWizard` @ `b721766befe2e89dca2c344eceba1053a7f0e338` (2026-10-16) | GPL‑3.0; solo referencia |
| Retro Rewind | v6.13.1 (2026-10-08) | de `update.rwfc.net`; no se sube |
| Emscripten | 6.0.12 (emsdk @ `1c9a998e`), en `herramientas/emsdk` | el mismo que BT3 |
| nodtool | 2.0.0-alpha.10 (`encounter/nod`), `herramientas/cache/nodtool.exe`, SHA-256 `1e150e33…948d` | el que fija WiiCompiled |
| Disco | `RMCP01` rev 0, RVZ v1 (zstd 19), ISO 4 699 979 776 bytes | `main.dol` debe dar SHA‑256 `80d18895b39c63bd80f457398bfcbb91b7d16ac116a41a88967e954080155b05` |

## PC de trabajo (2026-10-16)

- Windows 11 Pro, Ryzen 7 9800X3D, 61,6 GB RAM, RTX 3080 Ti, 1,6 TB libres.
- Ya instalado: git 2.56, Node 24.19, .NET SDK 6.0 y 10.0, CMake + Ninja (Strawberry), Python 3.12.
- El traductor (`net8.0`) corre en .NET 10 con `DOTNET_ROLL_FORWARD=Major`. Emscripten 6.0.12 instalado. WSL no hace falta.

## Fase 2 (runtime en wasm)

| Pieza | Versión | De dónde |
|---|---|---|
| SDL3 (port de Emscripten) | 3.4.2 | `--use-port=sdl3`, lo baja Emscripten de github.com/libsdl-org/SDL a su caché |
| xxHash | 0.8.4 | `terceros/xxhash-dl/` · SHA-256 del tar.gz `5738270935e7c3d38a79b3adf7c9692566ce7895a25f67de43ad52ab504acd32` (el mismo que fija aurora) |
| Crypto++, pugixml, toml11 | los que trae WiiCompiled | `terceros/Wiicompiled/runtime/third_party` |

## Fase 3 (aurora de verdad en el navegador)

Las bajan `herramientas/bajar-deps-aurora.sh` a `terceros/deps-aurora/` (ignorado), con las mismas versiones y
huellas que fija `aurora-main/extern/CMakeLists.txt`.

| Pieza | Versión | SHA-256 del archivo bajado |
|---|---|---|
| abseil-cpp | 20240722.0 | `f50e5ac311a81382da7fa75b97310e4b9006474f9560ac46f54a9967f07d4ae3` (aurora no la fija; anotada aquí) |
| fmt | 11.1.4 | `ac366b7b4c2e9f0dde63a59b3feb5ee59b67974b14ee5dc9ea8ad78aa2c1ee1e` |
| imgui | v1.91.9b-docking | `466fdef9b18de15f0bb6e288e3d00ffa3d82200ec458ce5e4f724a161d9528a5` + `parches/imgui-web.diff` |
| El motor de la etapa 2 del plan v4 (E2, bitácora §211–) | `terceros/Wiicompiled-motor` @ `2ab4195` (la base de E0/E1) | la rama **`e2-h6`** en la copia `terceros/Wiicompiled-motor-h6` (un `git worktree` de `terceros/Wiicompiled-motor`; `generated/` y `build/` son enlaces de carpeta a los de la base): **H6** `35b63ac` = `parches/motor-h6.diff` (`MKW_MOTOR_FIJA`, apagado por omisión en la cabecera; se prende con `compilar-web.py --fija`); encima `0256944` = `parches/motor-h7-techo.diff` (`MKW_H7_TECHO`, solo para medir, apagado, §212). No se juntó en `terceros/Wiicompiled-motor` porque ahí siguen los cambios sin commit de W10 (`MKW_SUCIAS`) en los mismos archivos: rehacer = `git apply parches/motor-h6.diff` sobre `2ab4195`. Instrumentos de E2 sin commit en ninguna copia (las copias espejo `terceros/Wiicompiled-motor-w12t` y `-w13t` las arman `herramientas/w12/techo.py` y `herramientas/w13/techo.py` desde `e2-h6`). **e2-w10** (§220, la base de E3/E4): la rama `e2-w10` en la misma copia, `f7181fe` sobre `0256944` = `parches/motor-e2-w10.diff` (W10 = `MKW_SUCIAS` junto con H6, apagado por omisión; rehacer = `git apply parches/motor-h6.diff parches/motor-h7-techo.diff parches/motor-e2-w10.diff` sobre `2ab4195`). **W14** (§217, no adoptado): en `terceros/Wiicompiled-motor-seguro` el commit `8812e4f` (sobre `3796636`) = `parches/traductor-w14.diff` |
| sqlite (amalgamación) | 3510300 | `acb1e6f5d832484bf6d32b681e858c38add8b2acdfd42ac5df24b8afb46552b4` |
| tracy (solo cabeceras, apagado) | `a64b9a20294d59421a2f57aeca3c6383d8c48169` | `24d342b5127d7f659dc3cf94f24347b348cc736f25b17a691fd7f69541937658` |
| emdawnwebgpu (port de Emscripten) | el que trae Emscripten 6.0.12 | `--use-port=emdawnwebgpu` |
| zlib, libpng (ports de Emscripten) | los de Emscripten 6.0.12 | `-sUSE_ZLIB=1 -sUSE_LIBPNG=1` |
| playwright-core | 1.56.1 | `banco/package.json` (`npm i` en `banco/`); usa el Chrome instalado (155.0.8059.80) |

## Paginita-Pro, conexión de Mario Kart (§236)

`parches/paginita-mkw-conexion.diff` se preparó sobre `989b2824690cad7c9562d81e25a851c0c70015cd`.
Con el clon en esa base, `git apply --check` y `git apply` desde el clon con la ruta al parche. Luego rearmar
`juegos-app.js` con esbuild según CLAUDE.md.
