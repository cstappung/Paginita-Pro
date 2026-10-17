# Versiones fijadas

Un commit fijo + nuestros parches = un resultado reproducible (como `COMMIT` en `construir.sh` de BT3).

| Cosa | Versión | Notas |
|---|---|---|
| WiiCompiled | `patchzyy/Wiicompiled` @ `bd219e38a3e9a1a5047ce41d8cd01210bef3af43` (2026-10-09) | GPL‑3.0; clon en `terceros/Wiicompiled` |
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
| sqlite (amalgamación) | 3510300 | `acb1e6f5d832484bf6d32b681e858c38add8b2acdfd42ac5df24b8afb46552b4` |
| tracy (solo cabeceras, apagado) | `a64b9a20294d59421a2f57aeca3c6383d8c48169` | `24d342b5127d7f659dc3cf94f24347b348cc736f25b17a691fd7f69541937658` |
| emdawnwebgpu (port de Emscripten) | el que trae Emscripten 6.0.12 | `--use-port=emdawnwebgpu` |
| zlib, libpng (ports de Emscripten) | los de Emscripten 6.0.12 | `-sUSE_ZLIB=1 -sUSE_LIBPNG=1` |
| playwright-core | 1.56.1 | `banco/package.json` (`npm i` en `banco/`); usa el Chrome instalado (155.0.8059.80) |
