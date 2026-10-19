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
`python herramientas/compilar-web.py --modo navegador`, jugar `node web/navegador/servidor.mjs` → http://127.0.0.1:8140/ (o `jugar.bat suelto`)
(solo esta PC; `MKW_LATENCIA=50` simula la red hasta R2), probar `node web/navegador/prueba-navegador.mjs 900` (Playwright, 21 puntos, o 20 con un monitor que no es múltiplo de 60 Hz: ahí no se exige «parejos en pantalla»; `cd banco && npm install`
la primera vez). Partidas: `node web/navegador/prueba-partidas.mjs` (6 puntos); en la nube (dos navegadores, la sala falsa): `node web/navegador/prueba-nube.mjs` (9 puntos). Celular: `node web/navegador/prueba-tactil.mjs`
(Pixel 7 emulado, 16 puntos). Manejar el juego con teclas y fotos: `node web/navegador/guion.mjs "K:2500 K:2000 …"` (ver su
cabecera; `P:ms` = perfil, `R` = recargar, `K~ms` = mantener; `--semilla` = guarda la semilla de pipelines
(`pipelines.bin`) y suma la de bloques (`bloques.json`, correrlo 3 veces) en `build/web/navegador/`: van con el `.wasm`,
nunca a git). CPU por cuadro en la carrera: `bash herramientas/medir-cpu.sh <etiqueta> ["&param=valor"]` (traza del
ritmo + `herramientas/tiempos-cuadro.mjs`). **Como en la página real** (§54): `node herramientas/sitio-local.mjs` →
http://127.0.0.1:8150/juegos.html?mkw=1 (el sitio de `terceros/Paginita-Pro` servido como GitHub Pages, sin COOP/COEP, y
el juego en el marco de Juegos; lo privado desde un "Worker" en 8151 con CORS y 50 ms de latencia; la página lo pide con
`?privado=ORIGEN`). Medir ahí: `node herramientas/medir-sitio.mjs --perfil pc|cpu4|celular --etiqueta X [--items]
[--visitas 2] [--red 50] [--extra "&param=…"]` (CPU por cuadro, ritmo en pantalla, GPU, hilo ocupado, heap, MB bajados →
`build/web/datos/medir-sitio/`). Lo que ve un jugador en línea (una pestaña, 60 s de carrera: cuadros, refrescos justos/repetidos/saltados, latido): `node herramientas/medir-enlinea.mjs ["&param=…" …]` (§63). Programa para publicar: `python herramientas/compilar-web.py --modo navegador --final`
(sin nombres de funciones + `mkw.wasm.br`, 16 MB; o `node herramientas/comprimir-build.mjs`). Caminos viejos para
comparar: `?esperaToma=0`, `?atrasada=0`, `?compas=0`, `?huella=0`, `?voces=0`, `?staging=mapeo`.
**La página entra directo al juego** (§66): sin portada (vuelve con `?portada=1`, la usan elegir/táctil/partidas), con una
cortina mientras carga y mientras el piloto recorre los menús (`?cortina=0` la apaga), y el juego avisa cada pantalla que
se activa (`paginas_nativo.cpp`, `Page::Activate`) para esconder «Retro WFC» (salvo `modo=enlinea`) y los «Settings» de
RR (`ocultar.mjs`; `?ocultar=0` = el juego tal cual). Probar: banco `ocultar` (11) y `node web/navegador/prueba-menus.mjs` (8 puntos).
**Abrir directo por código** (§71, pedido del dueño: nunca cortina + piloto apretando botones): `web/juego/directo_nativo.cpp` (envuelve `rr_overlay_8063550C` = SectionMgr::Update de RR; registra el mando, elige o crea la licencia, SetNextSection/RequestSceneChange; acciones de botones del juego llamadas directo, lista corta) + `web/navegador/directo.mjs` (`mkwDirecto.ir(0x48)`, `boton(BOTON.mundial)`). Single Player y `modo=enlinea` (Retro WFC: sección 0x55 → Mundial → el bucle del juego) ya van así; `?directo=0` = el piloto viejo. Probar: banco `directo` (16) y `node web/navegador/prueba-enlinea.mjs` (9).
**Menú de inicio «JloKart Wii»** (§67, `inicio.mjs`): sale sin `?modo=` si el Worker entrega su imagen **privada** (una persona real: nunca a git; `python -I herramientas/preparar-inicio.py <png>` → `build/web/navegador/imagenes/inicio/jlokart.webp`, sube con `subir-r2.mjs`); 401/403/404 = sin menú. Single Player/Local → `piloto.hasta`; Playwright no lo ve salvo `?inicio=1` (`?inicio=0` lo apaga). En el sitio: `#solo/mkw` (`crearMkwSolo`). Probar: banco `inicio` (14) y `node web/navegador/prueba-inicio.mjs` (14 puntos).
Caer del mapa (§68): `node web/navegador/prueba-caida.mjs [--ancho 1800 --alto 760]` (5 puntos: el negro del rescate de Lakitu es la transición del juego, con el juego a 60 cuadros/s, y tapa toda la imagen con cualquier ventana; screencast + contador de cuadros).
**`jugar.bat` = la página de Juegos en esta PC, solo con Mario Kart** (§69, `herramientas/experiencia.mjs`): emuladores de Firebase con las reglas del sitio (Java + `herramientas/cache/firebase-tools`), cuentas de mentira (Piloto Uno/Dos/Tres amigos, Intruso no), `sitio-local --emuladores --solo mkw` y el Worker de verdad (`worker-local --emulador` re-firma sus tokens), y 1-3 ventanas de Chrome con un perfil cada una (= otro PC). Lo jugado queda en `build/emuladores/datos` (Ctrl+C guarda; `jugar.bat limpiar`). `window.__FIREBASE_EMU`/`__JG_SOLO` solo valen en 127.0.0.1 (`mkw.test.cjs`). No es un artifact (el juego no puede subirse y un artifact no alcanza 127.0.0.1). La página del sitio es `juegos/mkw/web/navegador/index.html`: nada de rutas a `../banco` (`verificaciones.mjs`). Probar: `node herramientas/prueba-experiencia.mjs` (13 puntos, ~6 min; `--rapida` 10 sin la carrera).
**Las pruebas en Chrome van sin sonido** (`--mute-audio`): el dueño lo pidió.
Todas las pruebas con su planilla (§70): `node herramientas/correr-todo.mjs` (~25 min; `--sin-juego` ~1,5 min, `--solo a,b`, `--repetir N` para fallas intermitentes, `--lista`) → `build/web/datos/todo/<fecha-hora>/`.
Sala con CPU (lockstep, §61): banco `node banco/correr.mjs lockstep` (35 puntos) y con el juego `node web/navegador/prueba-sincro.mjs` (dos pestañas, 11 puntos; `--lento` = B con la CPU frenada: la sala va a su ritmo y avisa quién frena; `--puerto=N --datos=carpeta` para correr varias; `--extra=&arreglos=0` compara sin «todo a la vista»; `--sala` = dentro de la sala falsa del sitio; `--copa` = la copa entera, hasta 25 min, `--minutos=N`; `--pistas=50.2,… --semilla=N` = una carrera fija). En la página: `?vista=0` (sonido/HUD sin vista propia), `?camara=0`. El retraso se adapta a la red (§70: 3 a 8 cuadros, lo anuncia el decisor al empezar cada carrera); `?retraso=fijo` = siempre 3; `?redMala=70,10,5` = red mala de mentira (ms, ±ms, % perdido; solo pruebas). Depurar la carrera: `MKW_DEPURAR_LS=1` y el punto de vigilancia `MKW_CFLAGS_EXTRA=-DMKW_VIGIA … --carpeta build/web-vigia` (servirlo con `MKW_BUILD=build/web-vigia/navegador`), §62.
**Publicar (§65, lo hace el dueño: `docs/publicar.md`)**: lo privado va al R2 del dueño detrás del Worker de BT3 (rutas `/mkw/` en `terceros/Paginita-Pro/juegos/bt3/fuente/disco/worker.js`, pruebas `colabtex/tests/mkw-worker.test.cjs`); la página pide el token de Firebase a Juegos (`web/navegador/privado.mjs`, banco `privado`). Subir: `node herramientas/subir-r2.mjs` (revisar) / `--subir` / `--comprobar` con `R2_CUENTA`, `R2_ID`, `R2_SECRETO`, `R2_BUCKET` (prueba con R2 falso: `node herramientas/prueba-subir-r2.mjs`, 22 puntos). `sitio-local.mjs` ya corre **el Worker de verdad** (`herramientas/worker-local.mjs`, con token de prueba; `--worker servidor` = el de antes; `medir-sitio.mjs --worker-viejo` para comparar).
Banco sin el juego, sin ventana: `node banco/correr.mjs licencias mii …` (✓/✗ de cada página). Piloto con el juego: `node web/navegador/prueba-piloto.mjs` (9 puntos). La página: `interfaz.mjs` (inicio, modos, cajón, «Tu partida»), `menus.mjs` (memoria del juego y piloto: `?modo=vs&copa=13&fila=2&cpu=ninguna`), `mii.mjs`/`editor-mii.mjs`, `licencias.mjs`, `respaldos.mjs`. En línea: diseño en `docs/en-linea.md`.
