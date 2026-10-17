# Kit de Mario Kart Wii + Retro Rewind en el navegador

Copia del proyecto de trabajo `MKW RETRO` (en la PC del dueño), para que otra sesión pueda seguir desde aquí.
Es el equivalente a `bt3-port-kit` de BT3: el código propio, los parches a terceros, las pruebas y la documentación.
**No es una página publicada**: nada de esta carpeta se enlaza desde el sitio.

- Qué es y las reglas: `CLAUDE.md` (leer primero).
- Qué falta: `PLAN.md`. Qué se hizo, paso a paso, con un glosario para un ingeniero eléctrico: `docs/bitacora.md`.

## Qué NO está aquí (y por qué)

| Falta | Por qué | Cómo se consigue |
|---|---|---|
| El disco (`RMCP01`, `.rvz`/`.iso`) y lo extraído (`main.dol`, `StaticR.rel`, `.szs`) | Es del juego de Nintendo: nunca se sube | El disco propio del dueño; `nodtool extract` (ver `herramientas/traducir.ps1`) |
| El C++ que genera el traductor (`generated/`) y el `.wasm`/`.js` del juego | Es el ejecutable de Nintendo traducido | Se regenera: `herramientas/traducir.ps1` y `herramientas/compilar-web.py` |
| Las semillas `pipelines.bin` y `bloques.json` | Salen de correr el juego (rutas y bloques del disco) | `node web/navegador/guion.mjs … --semilla` (3 veces) |
| Retro Rewind (`RetroRewind6/`) | Sin licencia de redistribución publicada | `update.rwfc.net`, v6.13.1 |
| WiiCompiled (incluye `aurora-main/`, el renderizador) | Tercero enorme, se baja de su repo | `https://github.com/patchzyy/Wiicompiled` @ `bd219e38a3e9a1a5047ce41d8cd01210bef3af43` + `parches/runtime-web.diff` y `parches/aurora-web.diff` |
| Librerías de aurora (abseil, fmt, imgui, sqlite, tracy) | Terceros | `bash herramientas/bajar-deps-aurora.sh` (+ `parches/imgui-web.diff`); versiones y huellas en `herramientas/versiones.md` |
| Emscripten, nodtool, `node_modules` | Herramientas instaladas | `herramientas/emsdk.sh` (Emscripten 6.0.12); `cd banco && npm install` |
| Compilaciones (`build/`), capturas de pruebas, logs | Intermedios | Se rehacen |

## Armar el árbol de trabajo desde esta carpeta

```bash
git clone https://github.com/patchzyy/Wiicompiled terceros/Wiicompiled
git -C terceros/Wiicompiled checkout bd219e38a3e9a1a5047ce41d8cd01210bef3af43
git -C terceros/Wiicompiled apply ../../parches/runtime-web.diff
git -C terceros/Wiicompiled apply ../../parches/aurora-web.diff
bash herramientas/bajar-deps-aurora.sh
```

Después siguen los pasos de `CLAUDE.md` (traducir con el disco propio, compilar, probar). Sin el disco se pueden
correr las pruebas del banco (`banco/`), que usan datos falsos.
