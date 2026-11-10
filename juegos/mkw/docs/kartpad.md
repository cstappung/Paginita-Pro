# KartPad: la referencia completa

*Segunda pasada, la exhaustiva (2026-10-31), a pedido del dueño: «descarga y lee todo kartpad para saberlo todo». La
primera pasada (el mismo día) leyó partes sueltas de clones superficiales; esta bajó los repositorios **enteros, con
toda su historia y todas sus ramas**, y leyó sus documentos, sus commits, sus parches, sus herramientas, sus 163
issues y 380 PR, y sus 23 versiones publicadas. No se compiló ni se corrió nada de ellos y no se bajó nada del juego.*

*Cómo leer los números: **[KartPad]** = medido por ellos (con enlace), **[nuestro §N]** = de nuestra bitácora,
**[estimado]** = cuenta mía. Casi todo lo de ellos se midió en **un solo teléfono propio** (Pixel 9 Pro XL) o en el
**emulador de Android sobre un Mac M3 Max** (ellos mismos dicen: del emulador vale el tiempo de CPU por cuadro, nunca
los fps) o sale de registros que mandan los jugadores.*

**Qué se bajó** (en la carpeta temporal de esta sesión, nunca en el proyecto):

| Repositorio | Qué | Tamaño |
|---|---|---|
| <https://github.com/chrissotraidis/kartpad> | la app, documentos, herramientas; `main` @ `e8176a8` (2026-10-31), 1.599 commits (1.309 sin contar las uniones), 346 ramas | 85 MB (59 MB de historia) |
| <https://github.com/chrissotraidis/wiicompiled> | su copia mantenida de WiiCompiled: ramas `kartpad-android`, `-ios`, `-macos`, `-tvos`, `-translator` y ~100 `codex/*` (todas, en espejo) | 12 MB |

No tienen otro repositorio del que dependa la app: la aurora «beta» (la de WiiCompiled 0.9) viaja **dentro** de la
rama `kartpad-android` (carpeta `aurora-wiicompiled`), y **PadMint** (<https://github.com/chrissotraidis/padmint>,
GPL-3.0) es el armador que el jugador corre en su PC; KartPad trae en `builder/` el mismo motor. En la cuenta hay
copias (forks) de `aurora`, `DolRecomp`, `SDL`, `enet`, `plume`, `ModernGekko` y `libultraship` que la app no usa.
**No hay datos del juego en ningún repositorio** (ni `.dol`, `.rel`, `.szs`, ni C++ traducido): solo nombres y
direcciones de unos pocos ganchos en `builder/pipeline.py` y en `tools/mkwii-rmcp01-*.yml`, que esta referencia no copia.

---

## La respuesta corta

1. **KartPad es lo mismo que nosotros, pero nativo:** Mario Kart Wii PAL rev 0 + Retro Rewind, traducido por
   WiiCompiled y compilado a ARM64 para Android (Vulkan) y Apple (Metal). Es la mejor referencia que existe de
   **cuánto tarda el código traducido en teléfonos de verdad, sin el navegador**.
2. **Lo nuevo frente a la primera pasada**, en orden de importancia:
   - **Su aurora «Classic» es nuestra misma aurora** (la `aurora-main` de WiiCompiled en `bd219e3`), con 3.800 líneas
     suyas encima. Sus arreglos de imagen anteriores al 23 de septiembre **ya están en nuestra base**, porque se los
     pasaron a WiiCompiled en el PR #244 (`6f14bde`). Lo que nos falta de ella es poco, y está en la lista del final.
   - **Un error de una línea en la memoria de las llamadas indirectas**, que también tenemos: la casilla se elige con
     los bits **bajos** de una multiplicación de mezcla, que son los que peor mezclan. Lo encontró DriftDroid, otro
     port, y KartPad lo arregló en `20ad85d`. En nuestro código está en `runtime/include/guest_abi/dispatch.h`
     (líneas 339 y 359).
   - Su traductor **se quedó en `bd219e3`** (más tres arreglos): no tiene el traductor de la v0.9 (la «traducción más
     rápida y determinista», #358). **El nuestro va adelante** (v0.9.3 @ `0d5c402`). Del motor y la aurora de la
     v0.9.x tomaron arreglos sueltos, uno por uno, hasta el 31 de octubre: el sonido de #360 y la máscara de 6 bits de #376.
   - El «modo 30 fps de carrera» lo **adaptaron de DriftDroid** (<https://github.com/dorPXP/driftdroid>, GPL-3.0). Es el
     modo del propio juego para 3 y 4 jugadores: la lógica sigue a 60 pasos por segundo y se dibuja la mitad.
   - El 31 de octubre encontraron por qué la aurora nueva («beta») iba a 20 fps en el Pixel: **los tres hilos quedaban
     clavados a un solo núcleo**. Sueltos, iba a 48–60. Y el aviso de carga a Android mentía, porque contaba solo la
     CPU y no la espera. Las dos son lecciones para nuestro paso de hilos (H4).
3. **Ni siquiera nativo llega a 60 en la gama media:** el hilo del juego tarda ~14,5 ms en el Pixel 9 Pro XL, ~29 ms
   en un Dimensity 7300 y ~45 ms en un Helio G85 (12 karts). Ellos escriben que la gama media necesita «unas 2× menos
   trabajo» y la baja «unas 3×».
4. **Lo que conviene llevarse:** el arreglo de la memoria indirecta (gratis), las escrituras parciales de matrices XF
   (`38829c3`, si aparece el aviso), soltar las copias de textura que nadie usa (`0cca4d2`, memoria), **PGO** (su
   única ganancia firme de CPU: −12 %, y el código −13 %) y, si el dueño acepta dibujar a 30, su modo de 30 fps como
   referencia de N8.
5. **No cambia el plan; lo confirma.** Sube PGO, confirma que el gráfico fuera del hilo (H4) es la pieza grande (en
   ellos, el 21–26 % del hilo) y suma dos riesgos para teléfonos: los personajes invisibles en Adreno y la memoria que
   crece con cada pista.

---

## 1. Qué es KartPad

### 1.1 La arquitectura

| | KartPad | Nosotros |
|---|---|---|
| Traductor | WiiCompiled, rama propia `kartpad-translator`: `bd219e3` + 3 arreglos (`cc4087a` fix 279, `0dce414` #321, `d64053c` el país #511). Encima, su capa de coma flotante exacta | WiiCompiled **v0.9.3** @ `0d5c402` + nuestros parches (`herramientas/versiones.md`) |
| Juego | PAL `RMCP01` rev 0 (el mismo `main.dol`, SHA-256 `80d18895…`) + Retro Rewind **6.13.4** | el mismo disco + RR 6.13.1 |
| CPU | ARM64 nativo compilado antes (sin JIT: en iPhone está prohibido) | wasm en Chrome con JSPI |
| Imagen | **Classic** = la `aurora-main` de `bd219e3` + ~3.800 líneas suyas (arreglos de Adreno y PowerVR, repetición de recetas por pista, reempaque de vértices, autocomprobación de dibujo) → Dawn → Vulkan o Metal. **Beta** (Android, desde 0.8.6) = la aurora de WiiCompiled 0.9 (`aurora-wiicompiled`, `dd399416` de patchzyy), con la FIFO de GX y el dibujo en hilos propios | nuestra aurora (`bd219e3` + `aurora-web.diff` + `aurora-n15a.diff`) → WebGPU de Chrome |
| Hilos | el del juego hace la CPU de la Wii **y** la FIFO de GX (Classic); un hilo de dibujo de aurora; uno de presentar; uno de sonido | todo en el hilo de la página, salvo el sonido (worklet); el paso 8/H4 lo reparte |
| Memoria de la Wii | «plana»: 4 GiB reservados con la base elegida al arrancar. Cada acceso relee dos variables globales: la base y la marca de «acceso revisado», que hace falta en teléfonos con páginas de 16 KiB | tabla de páginas de 1 MiB + nuestros M1/M2 (§182) |
| Paquete del juego | el jugador traduce su disco con PadMint y sale un `.so` (Android) o `.dylib` (Apple). La app vacía es pública y el paquete es privado. Desde 0.7.0 el paquete se reconoce por una **huella de su interfaz** y sobrevive a las actualizaciones de la app | el `.wasm` va a R2 detrás del Worker |
| Licencia | GPL-3.0-only (`RIGHTS_AND_LICENSES.md`) | GPL-3.0 (el runtime adaptado) |

**La capa de coma flotante exacta** (`runtime/include/kartpad/semantics/ppc_semantics.h`, namespace `kartpad::semantics`).
El traductor de ellos convierte cada `fadd/fsub/fmul/fdiv/fmadd/fres/frsqrte…` en una llamada a un «adaptador» que
calcula el resultado **y además** las banderas del FPSCR. El FPSCR es el registro de estado de la coma flotante de la
PowerPC: avisa de desborde, de resultado inexacto, etc. Copian la tabla de `fres`/`frsqrte` de Dolphin bit a bit. La
prueban con 250.227 casos que dan la misma huella en ARM64 y en x86_64 ([SEMANTICS.md](https://github.com/chrissotraidis/kartpad/blob/main/docs/SEMANTICS.md)).
Upstream (y nosotros) usamos la coma flotante de la máquina sin banderas. Esa capa les costaba el 11–14 % del hilo;
desde 0.5.1 la saltean mientras el juego no pida avisos de desborde, y casi nunca los pide: hay **solo 6 lecturas del
FPSCR en todo el juego**, en rutinas del sistema operativo. *Comparación eléctrica: es como llevar un registrador de
fallas en cada interruptor; si nadie mira el registro, se puede desconectar sin cambiar lo que pasa por el circuito.*

### 1.2 Las versiones, con fechas

Fuentes: [docs/releases/](https://github.com/chrissotraidis/kartpad/tree/main/docs/releases), <https://github.com/chrissotraidis/kartpad/releases>, `/tags`.

| Fecha | Versión | Qué trajo |
|---|---|---|
| 28–30 ago | (arranque) | WiiCompiled `1912292` fijado; el título completo arranca en Mac; las 28 pistas llegan a la meta |
| 31 ago–2 sep | 0.2.0-preview.1–0.3.0-preview.5 | primer IPA sin firmar (iPhone/iPad, Metal), RR 6.12.4, A mantenida = acelerar fijo |
| 3–7 sep | 0.4.0–0.4.11 | tvOS, Mac propio; **7 sep: 0.4.10-android.1, el primer Android** (Pixel 9 Pro XL, Vulkan, API 28+); arreglo del número de serie (#94) |
| 8–17 sep | 0.4.12–0.4.25 (Android y Apple por separado) | partidas por perfil, validación de dibujo, RR 6.12.8, importar/exportar fantasmas `.rkg` |
| 20 sep | **0.5.0** | primera versión coordinada en las tres plataformas; repetición acotada de recetas de sombreadores |
| 22 sep | — | se integra WiiCompiled `8346376` en las 4 plataformas |
| 26–27 sep | **0.5.1**–0.5.4 | «Preparando gráficos X de Y» al arrancar, recetas por pista, el aviso de carga de Android, **saltar las banderas de FP que nadie lee** (14,7 → 12,65 ms) |
| 29 sep | 0.6.0 | se dejan de publicar binarios con el juego: el jugador arma su paquete con PadForge (luego PadMint) |
| 30 sep–5 oct | 0.6.1–0.7.14 | paquete con huella de interfaz; arreglo para PowerVR; mandos; autocomprobación de dibujo; actualización dentro de la app; volvieron las descargas listas para jugar (0.7.9) |
| 9 oct | 0.7.15 | RR 6.13.1 (Retro WFC vuelve a andar) |
| 12 oct | **0.8.0** | al día con WiiCompiled `bd219e3`; «Shake to Trick» |
| 13–21 oct | 0.8.1–0.8.5 | vuelta atrás del cambio de Adreno 6xx/7xx; RR 6.13.3 (ayudantes de FMA doble), RR 6.13.4; vibración |
| **25 oct** | **0.8.6** (build 268, la última publicada) | arreglos de WiiCompiled v0.9.0 y 0.9.1; **PGO** en el paquete de Android; **aurora beta**; «30 FPS Races»; «Simpler Computer Karts»; controladores de GPU propios (Turnip); el país en línea |
| 29–31 oct | (0.8.7 en preparación, PR #543) | Disable Bloom; reserva de 3,5 GiB en iPad (#530); **los hilos de la beta sueltos** (wiicompiled#16); **el aviso de carga con tiempo de pared** (#17); el sonido de upstream #360 y la máscara de 6 bits |

### 1.3 Cómo siguen a WiiCompiled

Fuentes: [UPSTREAM_UPDATES.md](https://github.com/chrissotraidis/kartpad/blob/main/docs/UPSTREAM_UPDATES.md),
[source-maintenance/](https://github.com/chrissotraidis/kartpad/tree/main/docs/source-maintenance), y la comparación
de sus ramas contra la de upstream (`git merge-base`).

- **Una rama por plataforma** en su copia de WiiCompiled. KartPad la ata con un submódulo a un commit exacto. Hasta
  septiembre era una pila de 99 parches que se volvía a aplicar cada vez; la retiraron con el PR #287.
- **Unen upstream de a tramos y después eligen arreglos uno por uno** («port reviewed changes only»):

| Rama | Último upstream unido entero | Commits de upstream que no tienen | Commits propios |
|---|---|---|---|
| `kartpad-android` | `bd219e3` (9 oct) | 47 (toda la v0.9.x; tomaron a mano ~15) | 158 |
| `kartpad-ios` | `bd219e3` | 47 | 105 |
| `kartpad-macos`, `-tvos` | `8346376` (19 sep) | 73 | 75 / 55 |
| `kartpad-translator` | `bd219e3` | 47 (**sin el traductor de v0.9**) | 7 |

- Las ramas de Android y Mac/iOS llevaron a mano, de la v0.9.x: la fecha real, Sky Station (#303), el «fix 280», la
  calibración del Wii Remote, la liberación de la superficie, el drift suave (#302), las escrituras XF parciales de la
  aurora nueva, el resto del sonido (#360) y la máscara de 6 bits (#376).
- Le devolvieron a upstream sus PR **#244** (`6f14bde`: alarmas, servicios sin red, lotes de dibujo, lecturas de la
  EFB, caché de pipelines, despertar del compilador, pantalla partida) y **#251** (mandos, errores de red). Por eso
  nuestra aurora ya trae esos arreglos.
- Retro Rewind: una acción diaria de GitHub avisa cuando sale una versión nueva. El número de funciones traducidas es
  una puerta de control: 29.065 de la base y ~4.101–4.139 de RR. Como cada versión nueva de RR obliga a traducir y
  compilar todo de nuevo, la app vieja se bloquea si el servidor de RR va adelante.

**Frente a nosotros:** en el traductor vamos adelante (v0.9.3). En el runtime, los dos partimos de `bd219e3`, pero
nosotros tomamos la v0.9.3 entera y ellos solo arreglos sueltos. En la aurora estamos iguales en la base, y cada uno
tiene sus parches.

---

## 2. Todos los números de rendimiento que publicaron

«Hilo» = la CPU del hilo del juego por cuadro. Todos son con 12 karts en carrera, salvo que se diga otra cosa. Para
comparar con nosotros, la sección 2.3.

### 2.1 Teléfonos y tabletas

| Aparato | Procesador / tarjeta | Modo | Resultado | Fuente |
|---|---|---|---|---|
| Pixel 9 Pro XL | Tensor G4 / Mali-G715 | Classic, Luigi, 2–3× | **~14,5 ms** el hilo, 60 fps (0.5.1: 14,70 → **12,65 ms**) | [handoff](https://github.com/chrissotraidis/kartpad/blob/main/docs/ANDROID-PERFORMANCE-HANDOFF.md), [artifacts 09-23](https://github.com/chrissotraidis/kartpad/tree/main/docs/artifacts/2026-09-23) |
| Pixel 9 Pro XL | ídem | Beta 0.8.6, 4×, hilos clavados | **19–22 fps**, 20–23 ms | [wiicompiled#16](https://github.com/chrissotraidis/wiicompiled/pull/16) |
| Pixel 9 Pro XL | ídem | Beta con los hilos sueltos | 48–60 fps (casi siempre ~55), 13–14 ms | wiicompiled#16 |
| Pixel 9 Pro XL | ídem | Beta, 3×, aviso de carga arreglado | mediana 52,3 → **59,9 fps**; núcleos medios 1,8 → 2,0 GHz | [wiicompiled#17](https://github.com/chrissotraidis/wiicompiled/pull/17) |
| Pixel 9 Pro XL | ídem | Classic, misma escena, antes del aviso | ~41 fps, después 60 | handoff (31 oct) |
| Pixel 9 Pro XL | ídem | carrera en línea de RR (build 218) | 39–60 fps (mediana 52), 14,5–19,7 ms; pausas de 106 y 129 ms por pipelines; una espera de red de 1.014 ms | [artifacts 09-25](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-09-25/android-code218-pixel.md) |
| Pixel 9 Pro XL | ídem | Peach Beach, vuelta 3 (build 111) | 53,8–60 fps, p99 32 ms; reparto: juego 54 %, dibujo 19 %, sonido 10 % de la CPU de la app | [artifacts 09-16](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-09-16/owner-gameplay-profiles.md) |
| Pixel 9 Pro XL | ídem | caliente (estado térmico 2–3) | 51 fps, 17,9 ms (el mismo build que daba 12,65) | artifacts 09-23 |
| Pixel 10a | Tensor G4 | 0.8.0, 2×, RR | 60 que caen a ~30 tras 1–3 carreras (13,5 → 20–29 ms), con calor «moderado» a los 8 min y hasta 3 GB | [#465](https://github.com/chrissotraidis/kartpad/issues/465) |
| Pixel 10a | ídem | 0.8.6 en línea, 2× | 78 de 80 ventanas ≥ 58 fps | [#339](https://github.com/chrissotraidis/kartpad/issues/339) |
| Galaxy S25+ | Snapdragon 8 Elite | 1× | 45–52 fps; 55–60 con «Game Booster» en rendimiento | [#103](https://github.com/chrissotraidis/kartpad/issues/103) |
| Galaxy S25 Ultra | Snapdragon 8 Elite | VS / en línea | ~41 fps; 60 en Contrarreloj | [#195](https://github.com/chrissotraidis/kartpad/issues/195) |
| AYN Odin 3 | Snapdragon 8 Elite (Adreno 830) | en línea, 0.8.5 | mediana 16,7 ms, tramos de 20–30, picos de 35–42; hilo ocupado 12,5–14,1 ms | [#504](https://github.com/chrissotraidis/kartpad/issues/504) |
| OnePlus 15 | Snapdragon 8 Elite Gen 5 | con el arreglo de personajes | ~50 fps | [#316](https://github.com/chrissotraidis/kartpad/issues/316) |
| Galaxy S22 | Snapdragon 8 Gen 1 | 0.4.17 | < 20 fps | [#278](https://github.com/chrissotraidis/kartpad/issues/278) |
| Retroid Pocket 5 | Snapdragon 865 | 1× | 40–45 fps; 60 en «alto rendimiento» (52 °C) | #103 |
| Galaxy S10 Lite | Snapdragon 855 | 0.8.6, tres copas seguidas | ~60 → mediana 42; memoria 1 → **2 GB**; pipelines 1.015 → 1.823 | [#510](https://github.com/chrissotraidis/kartpad/issues/510) |
| Honor Magic 8 Lite | Snapdragon 6 Gen 4 / Adreno 810 | 0.7.15 / 0.8.1 / 0.8.5 | 24 fps (32,5 ms) / 18 fps (39,2 ms, térmico 3) / 50–60 fps (15–20 ms) | [#470](https://github.com/chrissotraidis/kartpad/issues/470) |
| POCO X7 | **Dimensity 7300** / Mali | Original / RR | 40/30 fps / 30/25 fps; **~29 ms** | [#438](https://github.com/chrissotraidis/kartpad/issues/438) |
| Honor X7c | — | carrera | **36–40 ms** | [#313](https://github.com/chrissotraidis/kartpad/issues/313) |
| Tecno Spark 20c / KJ5 | **Helio G85** / Mali-G52 MC2 | 1×, 4:3 | 25–29 fps, **~30–45 ms**, hilo 94–97 % ocupado; presentar solo 2,3–2,6 ms | [#198](https://github.com/chrissotraidis/kartpad/issues/198) |
| Infinix Hot 60 Pro | Helio G200 | 1×, 0,75×, 0,5× | 15–30 fps (igual a toda resolución) | [#167](https://github.com/chrissotraidis/kartpad/issues/167) |
| POCO X3 | Snapdragon 732G / Adreno 618 | RR | 10–20 fps; 3 cierres por falta de memoria (1,8 GB) | [#275](https://github.com/chrissotraidis/kartpad/issues/275) |
| Huawei Y9 Prime 2019 | Kirin 710 / Mali-G51 | carrera | **~108 ms** (7–12 fps), aun a 0,5× | [#320](https://github.com/chrissotraidis/kartpad/issues/320) |
| Pixel 8 Pro | Tensor G3 | en línea | ~20 fps; menús con pausas de 2,2 s (la música de RR leída en el hilo) | [#123](https://github.com/chrissotraidis/kartpad/issues/123) |
| iPad Pro 10,5" | A10X | — | 30–45 fps | [#135](https://github.com/chrissotraidis/kartpad/issues/135) |
| iPhone 16 | A18 | elegir copa con los videos | lento; arreglado en 0.5.3 (los videos THP se decodificaban por un camino lento de memoria) | [#327](https://github.com/chrissotraidis/kartpad/issues/327) |
| iPad Pro 12,9" | M2 | carrera | 60 fps; pausas de 63–327 ms por pipelines tras cambiar de versión del sistema; ~0,9 MB por pipeline guardado | [artifacts 09-25](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-09-25/ios-menu-stutter-local-analysis.md) |

### 2.2 Mac y emulador (sirven para comparar CPU, no fps)

| Aparato | Modo | Resultado | Fuente |
|---|---|---|---|
| Emulador Android en M3 Max | Luigi, 12 karts | **7,8 ms** el hilo (±5 %); con PGO **6,9 ms** | [pgo-release.md](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-10-24/pgo-release.md) |
| ídem | Contrarreloj de 2 karts | 4,2–4,4 ms (12 karts ≈ ×1,8) | artifacts 09-23 |
| ídem | VS Luigi, CPU por segundo | 455 ms; con «30 FPS Races» **336**; con eso + «Simpler Computer Karts» 294 | [v0.8.6](https://github.com/chrissotraidis/kartpad/blob/main/docs/releases/v0.8.6.md) |
| Mac M2 | Moonview | 1,3 fps al primer uso → 46–54; la tarjeta ocupada solo el 12 % | [g11-moonview](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-08-30/g11-moonview-profile.md) |
| Mac | título, caché vacía / llena | mín 52 fps, p99 84 ms / mín 60, p99 17 ms | [PERF.md](https://github.com/chrissotraidis/kartpad/blob/main/docs/PERF.md) |
| Mac | 3–4 jugadores | 29,9–30,1 fps (el modo de 30 del juego) | PERF.md |
| Mac | 0.5.1, primera vez | 3.111 pipelines en 78,8 s, luego 60 | [macos-051](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-09-26/macos-051.md) |

### 2.3 Dónde se les va el hilo del juego

| Parte | Pixel, build 207 (sept) | Emulador (10 oct) | Nosotros (`techo-pasos.md`) |
|---|---|---|---|
| Código traducido | 45,8 % | 40 % (887 funciones; las 40 primeras = 10 %) | 44,5 % (1.886 funciones) |
| GX en el hilo del juego (FIFO, listas de dibujo, formatos de vértice, texturas, uniformes) | **26,3 %** | **21 %** | aurora 7,5 % + parte del `(program)` |
| FP exacta (banderas) | 13,9 % | 11–14 % | no la tenemos |
| TLS emulado de Android 9 | 5,6 % | 10 % | no aplica |
| Despacho de llamadas indirectas | 4,4 % | 6,5 % | 4,8 % |

Dentro del código traducido, el 43 % son lecturas y escrituras con desplazamiento fijo: el contexto y las variables
globales. *TLS («thread-local storage») son las variables propias de cada hilo; en Android 9 cada lectura pasa por una
función, como un relé intermedio que agrega demora.*

**Lo que concluyen, y vale para nosotros:** frena la CPU de un hilo, no la tarjeta. Bajar la resolución no cambia nada
(#167, #198, #320) y menos karts en pantalla sí (#313). El calor existe (estado térmico 2–3 en el Pixel y en #470), pero
no lo explica todo. La gama media necesita ~2× menos trabajo y la baja ~3×; para Helio ponen como meta realista
**30 estables**.

### 2.4 Llevado a nuestro wasm [estimado]

Igual que en la primera pasada. En el PC, su emulador da 7,8 ms y nuestro wasm ~11 ms dibujando todo [nuestro §166.5]:
**~1,4× su nativo**, no el ×2,45 que medimos contra nuestro propio nativo. La razón: ellos pagan la FP exacta, el TLS y
la recarga de la base de memoria en cada acceso. Con eso, y +16 % por la revisión de límites de Android [nuestro §160]:

| Teléfono | KartPad nativo | Nuestro wasm hoy | fps | Le falta para 16,7 ms |
|---|---|---|---|---|
| Pixel 9 Pro XL (Tensor G4) | 14 ms | ~23 ms | ~43 | ×1,4 |
| Dimensity 7300 | 29 ms | ~47 ms | ~21 | ×2,8 |
| Helio G85 | 45 ms | ~73 ms | ~14 | ×4,4 |

Comprobación con el Oppo (Dimensity 9500, un núcleo ~1,6× el Tensor G4): 23 ÷ 1,6 ≈ 14 ms, y medimos 12,5 ms «juego»
[nuestro §114]. Calza (±30 %). La escalera simulada de `techo-pasos.md` (gama media ×3–3,8, baja ×5,5) cae en el mismo
lugar o es algo pesimista.

---

## 3. Cada cambio de rendimiento que hicieron, y si nos sirve

Fuentes: [ANDROID-PERFORMANCE-HANDOFF.md](https://github.com/chrissotraidis/kartpad/blob/main/docs/ANDROID-PERFORMANCE-HANDOFF.md),
[archive/android-performance-handoff-2026-09-23.md](https://github.com/chrissotraidis/kartpad/blob/main/docs/archive/android-performance-handoff-2026-09-23.md),
[artifacts 2026-09-23 y 09-24](https://github.com/chrissotraidis/kartpad/tree/main/docs/artifacts),
[android-cpu-investigation](https://github.com/chrissotraidis/kartpad/blob/main/docs/artifacts/2026-10-10/android-cpu-investigation.md),
[tools/android-perf/](https://github.com/chrissotraidis/kartpad/tree/main/tools/android-perf). Los commits sin repo
son de la rama `kartpad-android` de su WiiCompiled; los que dicen «KP» son del repo de la app. Todo es GPL-3.0-only:
se puede reutilizar con atribución (autor, enlace y commit en el parche y en `herramientas/versiones.md`). Lo marcado
«DriftDroid» también es GPL-3.0.

### 3.1 Lo que conservaron

| Cambio | Qué es | A ellos | ¿Nos sirve? | Ganancia [estimado] | Costo |
|---|---|---|---|---|---|
| **PGO** (KP `5f33e5a4`, `scripts/build-game-pack.sh`, `tools/android-perf/pgo_dump.cpp`) | Compilar una vez con contadores, jugar, y recompilar guiado por lo que se usó | **−12 %** del hilo en una pista que el perfil no vio (7,81 → 6,91 ms); −19 % en la entrenada; paquete −13 % (133,8 → 116,9 MB). Con un perfil de **una sola** carrera el código **creció** un 9 % | **Sí** (M6, Punto 5 de `soluciones-motor.md`) | ×1,05–1,10; más en la gama baja por el código más chico | días. Ojo: el perfil lo tiene que leer la misma familia de clang que compila el wasm (Emscripten trae el suyo) |
| **Saltear las banderas de FP que nadie lee** (KP `a33cfeae`, build 198) | Si el juego no pidió avisos de desborde, no se capturan | 14,70 → 12,65 ms en el Pixel (junto con el aviso de carga) | No: no tenemos esa capa | 0 | — |
| **Aviso de carga a Android con el tiempo de pared** (`5c195c4`, wiicompiled#17) | Android baja el reloj si cree que sobra tiempo; ahora cuenta la espera y los hilos de aurora | mediana 52,3 → 59,9 fps | No hay ese aviso en Chrome. **Lección:** cuando el hilo del juego espere a otro (H4), el teléfono puede bajar el reloj solo. Tenerlo en cuenta al medir el Oppo | — | — |
| **Soltar los hilos de la beta** (`eb2f36d`, wiicompiled#16) | La beta los clavaba a los núcleos que «comparten caché», leyendo `/sys`; el Pixel solo informa la L1, así que los tres quedaban en uno | 19–22 → 48–60 fps | En el navegador no se eligen núcleos. **Lección:** dos hilos en el mismo núcleo no suman nada | — | — |
| **Arreglo de la memoria indirecta** (`20ad85d`, hallado por DriftDroid) | La casilla de la memoria de llamadas indirectas sale de los bits **altos** de la multiplicación de mezcla, no de los bajos | sin número propio | **Sí: tenemos el error** (`dispatch.h` 339 y 359: `& (kIndirectDispatchCacheEntries - 1)`) | ×1,00–1,02 (el despacho es el 4,8 % y solo se ahorra lo que hoy choca) | una línea + la prueba de que la carrera no cambia (no debería: es solo una memoria) |
| **«30 FPS Races»** (`20ad85d`, `runtime/src/hle/frame_rate_lock.cpp`, de DriftDroid) | Cambia la respuesta de la función del juego que elige 30 o 60: en toda carrera de un jugador, «30», el modo que el juego usa con 3–4 pantallas. La lógica sigue a 60 pasos por segundo (dos por imagen) y la pantalla repite cada imagen. Contrarreloj y fantasmas siguen a 60, como hace RR | CPU por segundo −26 % (455 → 336 ms), en el emulador | **Solo si el dueño acepta «30 dibujados»** (`techo-pasos.md` §5). Es la versión ya hecha de N8 sin interpolar. Antes: comprobar con huellas que da la misma carrera que a 60 (que dejen los fantasmas a 60 hace dudar). Nuestro R2 (§192) ya saltea el dibujo con huellas 75/75 | similar a R2 | horas |
| «Simpler Computer Karts» (`low_detail_karts.cpp`) | Las CPU usan el modelo de pantalla partida | −9 % más | **Prohibido** (§114.6: no se saca calidad) | — | — |
| Reempaque de vértices por atributo (`ac118be`) | Recorrer atributo por atributo y no vértice por vértice | −27–34 % en esa función (prueba chica en Mac) | No: es su arreglo para Adreno, que no tenemos | — | — |
| Sin información de depuración (`-g0`, KP `65c82f58`) | — | compilar −37 % | Ya: `--final` | — | — |
| Recetas de pipelines por pista (`c59e33b`, `f1677be`, `102c7a7`) y tope de precalentado (128, o 512 con ≥ 6 GB) | Al cargar una pista se compilan las recetas que esa pista usó la vez anterior | segunda visita: lo creado en carrera, ~60 → 5 | **Ya lo tenemos a nuestro modo**: C2 de §174 (pipelines por pista) y el tope de §117 | — | — |
| Copias de carrera que se saltan un dibujo no listo (`a5f504a`, `f7347f4`) | Pasados 2 s de carrera, una copia de textura que se repite cada ≤ 4 cuadros puede saltarse un dibujo cuyo pipeline no está listo, en vez de congelar 50–300 ms | sin pausas en carrera (código 227) | Nuestra aurora tiene la regla de upstream (`GXFrameBuffer.cpp` 524: repetida en el cuadro anterior = se puede saltar), que también vale en los menús. La de ellos es más estricta fuera de la carrera y evita las miniaturas negras (sección 4) | tirones, no CPU | horas |
| **Soltar las copias de textura sin uso** (`0cca4d2`, solo la parte del «pool») | Una copia de repuesto que nadie pide hace 300 cuadros se libera | poca memoria (copias 5,4 MiB en total) | **Sí**, barato: hoy nuestro `g_copyTexturePool` no suelta nunca | memoria, poca | horas |
| Guardar la caché de pipelines de Dawn al estar quieto (`802bee0`, wiicompiled PR #2) | — | 303/303 aciertos al volver | En Chrome lo hace el navegador | — | — |
| FIFO de Vulkan en vez de Mailbox (`8a9e885`) | Presentar con cola: menos saltos, +8,7 ms de demora | 59,2 vs 56,6 fps; −75 % de saltos > 25 ms | No: lo decide Chrome | — | — |
| Tirar el retraso de retrazados de más de 3 s (`05b2cb8`, #330) | Al volver del fondo, el juego corría varias veces más rápido | arregla el «modo turbo» | **Ya lo tenemos**: §120/§134 (dormir y pausa con la pestaña oculta) y nuestro control del ritmo en `vi.cpp` | — | — |
| Listas de dibujo y FIFO: llamada directa, lotes XF, clasificación en caché, snapshot sin formatos vacíos, sin reloj para teclas inactivas, ventana de ARAM una vez por voz (`48e71de`, `b435655`, `e3cb77f`, `b0e3349`, `b864121`, `51b4c45`, `7560a3b`) | — | −1 a −2,4 % cada uno, casi en el ruido | **Ya están en nuestra base**: llegaron a upstream (PR #244 y siguientes). `DisplayListMayContainDraw`, `GX_CMD_CALL_DL_CMD` y `AramWindow` aparecen en `terceros/Wiicompiled-motor` | — | — |
| DVD: copia en bloque, caché de 8 archivos abiertos, Yaz0 con búferes (`5599719`, `0ce6a52`, `97cdc9a`) | — | abrir 4 KiB: 224,7 → 39,8 ms (prueba chica) | Nuestro disco es otro (MEMFS + caché de bloques) | — | — |
| Recibir de la red sin bloquear (`c5ad680`) | La recepción estacionada en el hilo del juego | quita pausas de hasta 5 s | No usamos su red | — | — |

### 3.2 Lo que probaron y descartaron (todo con su número)

| Cambio | A ellos | ¿Para nosotros? |
|---|---|---|
| Memoria plana en variables locales (`KARTPAD_FLAT_FUNCTION_LOCALS`, `tools/android-perf/patches/android-runtime-flat-memory-locals.patch`) | código −6,4 %, tiempo −1,4 % (ruido); pendiente de probar en un teléfono | Ya lo cubren mejor M1/M2 (+5,2 % en la gama baja, §182) y H6. Nada nuevo |
| Pasar el contexto a la FP en vez de leerlo por TLS | TLS 10,4 → 2,5 % del perfil, **0 ms** en el cuadro | No aplica. Misma lección que §178: sacar lecturas que ya estaban en la caché no rinde |
| Camino rápido de la FP «normal» copiado en cada uso | código +12 %, **10 % más lento** | No aplica; **la misma lección que nuestra FMA «punto medio»** (§184): copiar en línea en miles de lugares agranda el código y pierde |
| Atajos de FP con operandos exactos (builds 191/192) | +9 MB de código, sin ganancia | No aplica |
| Otra convención de llamada (`preserve_all`) | 0 | No probarlo |
| Orden de 512 funciones según el perfil | páginas 1.139 → 760, tiempo igual | Lo que daría H11 lo hace mejor PGO |
| Caché delantera de listas de dibujo 256 → 2.048 | aciertos 22 → 47 %, tiempo igual | No probarlo |
| TLS nativo de Android 10, casilla de contexto del hilo | TLS 6,1 → 0,9 %, tiempo igual | No aplica |
| Atar los hilos de dibujo a los núcleos grandes | ganó 1 min, perdió en 10 min | No aplica |
| Ensamblador directo para el FPSR (Mac) | prueba chica −26 %, en el juego 0 | No aplica |
| Precalentar 256 recetas en vez de 128 | sin ganancia repetible | Coincide con nuestro tope de §117 |

**Pendientes en su lista** (cada uno < 2 %): una huella incremental de la disposición de vértices (~1,7 %), las fallas
de la caché delantera de listas (~1 %) y la revisión de TLS en cada llamada traducida. **Lo grande pendiente es sacar
la FIFO de GX del hilo del juego**, que ellos estiman en el 21 %. DriftDroid midió ~19 % y advierte que mandar
primitiva por primitiva al otro hilo **pierde**: a ~20 fps, contra lotes de 32 KiB. Es nuestro H4/A1.

---

## 4. Los arreglos de correctitud: cuáles tenemos

Revisado contra `parches/`, `terceros/Wiicompiled-motor` (v0.9.3 + paso 6) y `terceros/aurora-main-viejo-motor`
(nuestra aurora), buscando en el código de cada lado.

### 4.1 Imagen (aurora)

| Arreglo | ¿Lo tenemos? | Prueba |
|---|---|---|
| Máscara de 6 bits en los índices de matriz (`6e3ce40`; upstream #376) | **Sí** | `command_processor.cpp` 1961 y 1985 (`& 0x3fu`, `aurora-n15a.diff`) |
| Sky Station: color constante sin fuente = 0 (#303), etapa indirecta a una coordenada inexistente (#348) | **Sí** | `aurora-n15a.diff` (§170) |
| Profundidad del viewport recortada a [0,1] después de invertir Z (`3bb89c5`, #325) | **Sí** | `common.cpp` 1867–1868 |
| Fusión de dibujos: corta al cambiar el formato o al invalidar vértices, desborde de índices de 16 bits, cuadriláteros de 1–3 vértices (`efb63c1`, `105c329`, `485f0ca`); lectura de 3 bytes que leía 4; lecturas de la EFB escaladas y la vida de sus avisos (`438421a`); espera del búfer de subida que daba vueltas 2 millones de veces (`68ffb2d`, `851ff32`); limpieza de ImGui a medio arrancar (`75951f4`); copia BGRA/RGBA (`fd1bce1`) | **Sí** | llegaron a upstream con el PR #244 (`6f14bde`), que está en `bd219e3`, nuestra base |
| **Escrituras parciales de matrices XF** (`38829c3`, de la aurora nueva `998c456`) | **No** | nuestro `copy_xf_data` (`command_processor.cpp` 309, 323, 341) todavía **rechaza** una carga que empieza a mitad de una matriz («sub-copy unsupported»). Primero, buscar ese aviso en el registro de una carrera |
| **Miniaturas negras de karts con la caché fría** (KartPad: toda copia de textura espera sus pipelines, salvo las de carrera repetidas, `c716643` + `a5f504a`) | **No; tenemos la regla de upstream** | upstream deshizo el arreglo de KartPad (`e409d9f`, «causa tirones») y nuestra aurora tiene esa versión (`GXFrameBuffer.cpp` 524–525). Si alguna vez vemos miniaturas negras en la selección de karts con la caché vacía, esta es la causa y la regla de ellos el arreglo |
| Copias de repuesto que no se sueltan (`0cca4d2`) | **No** | ver sección 3.1 |
| Personajes invisibles en Adreno: búferes de uniformes nativos con `array<vec4u,3>` en vez de `array<u32,12>` (`a1db7a3`, `df68471`), matrices leídas por filas como Dolphin (`fa8ee6b`), reempaque de vértices (`a4befb7`, `8deed05`, `e3d4a26`, `b0ca427`), consulta constante de matriz (`4659192`) | **No, y no hace falta todavía** | ninguno arregla el S24 (#104); solo «Automatic» arregla Adreno 8xx. Si un jugador con Adreno ve personajes invisibles, empezar por el `vec4u` (es std140, la disposición que Dawn lee nativa) |
| Límite de variables entre etapas para PowerVR (14 → 16, #304, 0.7.4) | No | lo resuelve el Dawn de Chrome, no nosotros |
| Interpolación en pantalla partida: la historia por viewport (Mac, #127, PR #157) | No aplica hoy | nuestra sala usa una pantalla por consola (§73) |

### 4.2 CPU, coma flotante y Retro Rewind

| Arreglo | ¿Lo tenemos? | Prueba |
|---|---|---|
| Ramas condicionales con enlace (`bltl`…) que no ponían LR (fix 279, `cc4087a`); punteros de Kamek que eran datos (#321, `0dce414`) | **Sí** | en v0.9.0, antes de nuestra v0.9.3 |
| Cargas y guardados de pares de coma flotante por el camino rápido de la tabla de páginas (`173b294`, #327) | **Sí** | upstream #267; `ppc_isa_quantized.h` 342 usa `Memory::Read64` |
| Ayudantes de FMA doble con estado (`34dbc52`, para RR 6.13.3) | No aplica | son de su capa exacta; nuestro traductor no los emite. Al pasar de RR 6.13.1 a 6.13.3+, comprobar que todo compila |
| RR: retorno de los ganchos que saltan adelante (#248, Item Rain), continuaciones de LR compartidas | Sí, en forma | nuestro traductor v0.9.3 trae las continuaciones de upstream; la versión de ellos, que achica el código de RR de +41 % a +16 %, es suya. **A mirar si algún día el tamaño de las piezas de RR molesta** |
| RR 6.13.4: 21 palabras de datos tratadas como código | Sí | v0.9.0 |
| Fecha real del reloj (`9058913`), país y globo (#511, `d64053c`) | Fecha: sí. País: no hace falta | sin Retro WFC (§73) |
| Número de serie de la consola (#94) | Sí | upstream `e0e362b` |
| La FP exacta (FPSCR, `fres`/`frsqrte` contra Dolphin) | **No, y no hace falta** | para la sala basta con que todas las consolas hagan lo mismo (huellas 75/75, fantasmas iguales). Si un fantasma real de la Wii se separa, su tabla de `fres`/`frsqrte` es el primer sospechoso |
| Fantasmas de RR inyectados que se separaban del jugador | No arreglado tampoco en ellos | usan los fantasmas del personal como carga de prueba; nuestros fantasmas de la página (§92) son nuestros propios `.rkg` |

### 4.3 Sonido, mandos, partidas

| Arreglo | ¿Lo tenemos? | Prueba |
|---|---|---|
| El sonido ~0,5 % más lento que el reloj, que vaciaba la cola y crepitaba (upstream #360, `814aa30`) | **Sí** | `audio.cpp` sin cambios desde `0d5c402`; además nuestro worklet se adapta (§88) |
| Música leída en el hilo del juego en los menús en línea (#123) | Distinto | nuestra precarga y el paquete de carrera (§169, §176) |
| Dos lecturas del mando (KPAD y WPAD) que se comían el mismo toque corto (`f5aa583`) | **Revisar** | lo nuestro llega como mando de GameCube (PAD), no por WPAD; solo importaría si se usa el Wii Remote |
| La vibración fuera del hilo del juego (KP `235d6793`) | Sí, a nuestro modo | `vibracion.mjs` (§167) |
| Activar un paquete reemplazaba la carpeta de partidas (#169) | No aplica | `guardado.mjs` |

---

## 5. Sus problemas abiertos que nos pueden tocar

| Problema | Qué les pasa | ¿A nosotros? |
|---|---|---|
| **Personajes invisibles en Adreno 6xx/7xx** (#104 S24 Ultra/Adreno 750, #301 Moto G85/Adreno 619, #472 OnePlus, #492 Honor) | cuerpos que no salen o salen lejos y desaparecen al acercarse, cabezas flotando; la causa no está cerrada (no es la máscara de 6 bits, ni matrices inválidas, ni la fusión de dibujos). Solo «Automatic» arregla Adreno 8xx | **Sí, puede**: Chrome en Android también dibuja con Vulkan por Dawn. El Oppo es Mali y por eso no lo vimos. Sin un teléfono Adreno no se prueba: se anota para el primer informe de un jugador |
| PowerVR (Moto G54, #304) | geometría que explota | puede |
| **La memoria crece con cada pista** (#510) | los pipelines compilados no se sueltan nunca (~1 MiB cada uno): Luigi 323 MiB → +Mario 371 → +Peach Beach 519 → +Sherbet 557; volver a Luigi sigue en 556 y solo reiniciar baja a 323. El S10 Lite llegó a 2 GB y bajó a 42 fps | **Revisar**: nuestra aurora es de la misma familia. En la sala (una copa entera) pasaría lo mismo. Medir con `medir-memoria.mjs` tras 4–8 pistas distintas |
| Tirones con la cola de sombreadores vacía (#504) | p95 20–31 ms en un Snapdragon 8 Elite | nuestro presupuesto por pieza (§149) y el tramo fijo lo miran |
| Calor | 60 → 30 tras 1–3 carreras en un Pixel 10a a 2× (#465); estado térmico 3 en #470 | medirlo con el Oppo en una copa entera |
| La primera vez de cada sombreador (50–300 ms en Mali, 63–343 ms en iPad) | — | ya atacado: §117, §133, §174 |
| Parpadeo en pantallas de 60 Hz al arrancar (#390, iPhone 16) | — | no aplica (no hay iPhone) |
| Error de lectura del disco en línea (#537) | — | no aplica (nuestro disco por lotes) |

---

## 6. Lo que tienen y nosotros no (por si le importa al dueño)

- **Gráficos:** «Disable Bloom» (desde 0.8.7, guardado; no cuesta casi nada: es la máscara del camino de
  posproceso). Nosotros no lo tenemos y **sacar efectos está prohibido como optimización**; solo serviría como gusto
  del jugador, y lo decide el dueño. También tienen la elección de motor de dibujo (Classic/Beta), el selector de
  controlador de GPU (Turnip) y la «Character Graphics Test» para Adreno.
- **Controles:** «Shake to Trick» (sacudir el teléfono = truco), tocar y mantener para el objeto (0,67 s), L3/R3 para
  trucos, Joy-Con suelto girado, vibración del teléfono si el mando no tiene motor, intensidad 0–200 %. Nosotros ya
  tenemos el editor táctil, inclinar, «Acelerar solo», reasignar todo y la vibración (§111–§113, §167). Lo único nuevo:
  **sacudir para el truco**.
- **Juego:** importar y exportar fantasmas `.rkg` (también los comprimidos de Chadsoft), packs de música de RR
  (`.brstm`), respaldo de `rksys.dat`, importar Miis `.mii`.
- **En línea:** Retro WFC de verdad (nosotros no, por decisión del dueño, §73). No tienen salas propias ni LAN; las
  nuestras van más lejos.
- **Medición:** ventanas sostenidas sin reiniciar (`capture-window.py`), A/B alternado con arranque en frío (`ab.sh`) y
  una regla que también conviene: **un cambio menor que el ruido (~±5 %) no se da por bueno**.

---

## 7. Qué adoptar, en orden

| # | Qué | Commit de ellos a portar | Por qué | Costo | Toca el plan |
|---|---|---|---|---|---|
| 1 | **La memoria indirecta por los bits altos** | `20ad85d` (solo `IndirectDispatchCacheIndex` de `runtime/include/abi_bridge.h`; en nosotros va en `guest_abi/dispatch.h` 339 y 359) | es un error real, se arregla con una línea y no cambia la carrera | horas, con prueba de huellas y `medir-node-estable` intercalado | junto a M8 «memo» (§193): medir antes y después |
| 2 | **PGO** | KP `5f33e5a4` (`scripts/build-game-pack.sh`: `-fprofile-instr-generate` y `-fprofile-list` sin las piezas de RR, `pgo_dump.cpp` escribe cada 30 s, 3 sesiones de entrenamiento, `llvm-profdata merge`, `-fprofile-instr-use`) | su única ganancia firme de CPU, y además achica el código (lo que perdió la gama baja en §184/§193) | días; el perfil, privado (lleva nombres del juego) | M6: subirlo antes que las pasadas M8 que quedan |
| 3 | **Escrituras XF parciales** | `38829c3` (port de `998c456` de la aurora nueva) | correctitud; ellos y upstream ya lo tienen | horas | solo si el aviso «sub-copy unsupported» aparece en el registro de una carrera o de un menú |
| 4 | **Soltar las copias de textura sin uso** | la mitad «pool» de `0cca4d2` (`kCopyTexturePoolIdleFrames = 300`, `lastUsedFrame`) | memoria en la sala larga | horas | con la medida de memoria por pistas de la sección 5 |
| 5 | Memoria por pistas: medir y, si crece como en #510, soltar pipelines viejos | — (ellos no lo arreglaron) | el S10 Lite cayó a 42 fps con 2 GB | días | agregar a la fase de medir (V) |
| 6 | Copias de textura estrictas fuera de la carrera | `c716643` + `a5f504a` + `f7347f4` | solo si aparecen miniaturas negras | horas | — |
| 7 | El modo de 30 del juego | `20ad85d` (`frame_rate_lock.cpp`, adaptado de DriftDroid) | referencia para N8/R2, **solo si el dueño acepta 30 dibujados**; antes, huellas iguales a 60 | horas | decisión pendiente de `techo-pasos.md` §5 |
| 8 | Adreno: uniformes `vec4u` | `a1db7a3`, `df68471` | solo con el primer informe de un jugador con Adreno | horas | — |

**Lo que no hay que probar** (ellos ya lo midieron en cero): pasar el contexto en vez de TLS, FP copiada en línea,
otra convención de llamada, orden de funciones a mano, cachés delanteras más grandes y atar hilos a núcleos.

## 8. ¿Cambia el plan (versión 4)?

**No en lo grande; sí en tres detalles.**

- **Agregar** el arreglo de la memoria indirecta (ítem 1) como tarea corta del paso 6. Es lo único nuevo del motor que
  nos falta.
- **Subir PGO (M6)** antes de las pasadas M8 que quedan: es lo único que les dio una ganancia firme, y su receta
  (varias carreras, sin contadores en RR) evita el error de agrandar el código.
- **Al paso de hilos (H4/H5):** (a) mandar la FIFO de GX al otro hilo por lotes, nunca primitiva por primitiva
  (DriftDroid); (b) medir en el Oppo si el reloj de los núcleos baja cuando el hilo del juego espera, como les pasó en
  Android; (c) su beta, ya repartida en hilos, dio 13–14 ms contra ~14,5 de la Classic en el Pixel: **una ganancia
  modesta** (~×1,05–1,10 en nativo), porque la FIFO no es toda la cuenta. El ×1,15–1,30 del plan para H4 es posible en
  nosotros porque en wasm el gráfico pesa más, pero no hay que esperar más que eso.
- **Sumar a la fase de medir:** la memoria tras una copa de pistas distintas y el riesgo Adreno.
- La gama media y la baja: un programa nativo no llega a 60 ni en un Dimensity 7300 ni en un Helio G85 con 12 karts.
  Eso **refuerza** la decisión que propone `techo-pasos.md` §5: 60 de carrera, dibujo que alcance y 60 a la vista para
  la gama media; el video desde un PC de la sala para la baja. Ellos llegaron a lo mismo por su lado: la opción de 30
  en carrera y «30 estables» como meta para Helio.
