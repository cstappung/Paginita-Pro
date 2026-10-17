# MKW RETRO — Mario Kart Wii (+ Retro Rewind) en el navegador

Proyecto: llevar Mario Kart Wii a la sección Juegos del sitio (repo `cstappung/Paginita-Pro`) con la misma
arquitectura que BT3 (`bt3-port-kit`, `GUIA-BT3.md`), partiendo de **WiiCompiled** (static recomp PowerPC → C++).
El plan vivo está en `PLAN.md`; el análisis en `docs/analisis.md`.

El dueño escribe en español y prefiere explicaciones simples con ejemplos, y código con comentarios línea por
línea más un resumen general. **Es ingeniero eléctrico, no de software**: la bitácora debe **explicarlo todo**
(qué es cada cosa, por qué se hizo, qué significa el resultado), y cada término técnico nuevo entra al
**Glosario** del principio de `docs/bitacora.md` (qué es y qué hace, con una comparación eléctrica si ayuda).

## Decisiones tomadas

- **El producto es Mario Kart Wii con Retro Rewind instalado** (perfil `retro-rewind` de WiiCompiled desde la
  primera compilación). El juego base solo sirve de referencia para depurar.
- **Todo se simula y se prueba en el banco** (`banco/`), como el de BT3: páginas sueltas tipo artifact con ✓/✗
  visibles, datos falsos con la forma del juego (nunca datos reales), Worker/Firebase/WebRTC locales y pruebas
  de Playwright. Ninguna pieza se da por buena sin su prueba en el banco.
- **Documentar cada paso** en `docs/bitacora.md` (qué, por qué, comando exacto, resultado, trampas) y marcar el
  avance en `PLAN.md` (el registro de avances lleva **fecha y hora**: `**AAAA-MM-DD HH:MM** — …`). Lo repetible va en un script comentado en `herramientas/`.
- **Todo el trabajo vive en esta carpeta** (`C:\Users\zilon\Desktop\Gaming\MKW RETRO`).
- **60 fps** (la velocidad nativa del juego), no 30 como BT3. Presupuesto: 16,7 ms por cuadro.
- **WebGPU**, no WebGL2: aurora (el renderizador de WiiCompiled) ya habla WebGPU vía Dawn.
- **JSPI** como en BT3 (Chrome/Edge escritorio y Android). Sin iPhone.
- **Controles: teclado, mandos (Gamepad API, varios a la vez) y celular** (mando táctil + dirigir inclinando el
  teléfono). Todo llega al juego como un mando de GameCube por un gancho de la página.
- Disco: PAL `RMCP01` revisión 0 (`Mario Kart Wii (Europe Australia) (EnFrDeEsIt)/…rvz`).

## Reglas (no negociables)

- **Nada del juego entra a git ni se publica**: ni la imagen, ni lo extraído (`main.dol`, `StaticR.rel`, `.szs`),
  ni el C++ generado por el traductor (**es el ejecutable de Nintendo traducido**), ni el `.wasm` del juego.
  Todo eso está en `.gitignore`; revisar `git status` antes de cada commit.
- El `.wasm`/`.js` del juego se sirve **solo** desde R2 detrás del Worker de amigos (como el disco de BT3).
  La página, la sala y la red sí pueden ser públicas.
- Los archivos de Retro Rewind (`RetroRewind6/`) no tienen licencia de redistribución publicada: tampoco se suben.
- WiiCompiled y WheelWizard son **GPL‑3.0**: lo que derive de su código (el runtime adaptado) es GPL‑3.0. Para
  la lógica de WheelWizard (rksys, friend codes, Miis) reimplementar desde la documentación pública (Tockdom).
- Repos de terceros en `terceros/` (ignorados): sus cambios se guardan como parches en `parches/`, con el commit
  fijado en `herramientas/versiones.md` (igual que `parche.diff` de BT3).
- Firebase y el Worker los publica el dueño a mano. PR/merge en Paginita-Pro solo cuando el dueño lo pida.

## Carpetas

| Carpeta | Qué es | ¿En git? |
|---|---|---|
| `docs/` | Análisis y notas | sí |
| `parches/` | Nuestros cambios a WiiCompiled (diff) | sí |
| `herramientas/` | Scripts de instalación/compilación, `versiones.md` | sí (salvo `emsdk/`, `cache/`) |
| `banco/` | Banco de pruebas (simuladores, páginas tipo artifact, Playwright) | sí |
| `web/` | Nuestro código para la web: `headless/` (aurora sin pantalla, extras vacíos), `node/` (correr el juego en Node y su prueba). Sin nada del juego | sí |
| `terceros/` | Clones de WiiCompiled y WheelWizard; Retro Rewind; y **dentro de `terceros/Wiicompiled/`** lo que produce el traductor (`generated/`, `build/`, `Assets/`, `PulsarPacks/`) | **nunca** |
| `extraido/` | Archivos del disco (`nodtool extract`) | **nunca** |

Para retraducir desde cero: `powershell -ExecutionPolicy Bypass -File herramientas\traducir.ps1`.
Para compilar el juego a wasm: `python herramientas/compilar-web.py`; correrlo en Node: `node web/node/correr.mjs 300`;
probarlo: `node web/node/prueba-arranque.mjs` (13 puntos ✓/✗).
En el navegador (fase 3): librerías de aurora `bash herramientas/bajar-deps-aurora.sh` (una vez), compilar
`python herramientas/compilar-web.py --modo navegador`, jugar `node web/navegador/servidor.mjs` → http://127.0.0.1:8140/
(solo esta PC; `MKW_LATENCIA=50` simula la red hasta R2), probar `node web/navegador/prueba-navegador.mjs 900` (Playwright, 21 puntos; `cd banco && npm install`
la primera vez). Partidas: `node web/navegador/prueba-partidas.mjs` (6 puntos). Celular: `node web/navegador/prueba-tactil.mjs`
(Pixel 7 emulado, 16 puntos). Manejar el juego con teclas y fotos: `node web/navegador/guion.mjs "K:2500 K:2000 …"` (ver su
cabecera; `P:ms` = perfil, `R` = recargar, `K~ms` = mantener; `--semilla` = guarda la semilla de pipelines
(`pipelines.bin`) y suma la de bloques (`bloques.json`, correrlo 3 veces) en `build/web/navegador/`: van con el `.wasm`,
nunca a git). CPU por cuadro en la carrera: `bash herramientas/medir-cpu.sh <etiqueta> ["&param=valor"]` (traza del
ritmo + `herramientas/tiempos-cuadro.mjs`). **Las pruebas en Chrome van sin sonido** (`--mute-audio`): el dueño lo pidió.
