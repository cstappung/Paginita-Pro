# JloKart Wii a 60 fps: plan de rendimiento

> Todo lo que frena al juego (un jugador y sala, PC y celular): la causa, el arreglo y cómo se comprueba, hasta dónde llega cada aparato y el paso a paso para llegar a 60 fps con 12 karts.

**Fecha:** 2026-10-27 · versión 4: 2026-10-31 · **Estado:** versión 4 (pilotos, el dibujo en otro núcleo, el motor y las islas), 92 de 152 ítems hechos · **Página (artifact):** https://claude.ai/artifact/Ra7WusxMirhWmobs7aNWSo

## Cómo leer este archivo (para Claude)

Este es el plan de rendimiento que pidió el dueño el 2026-10-27. **Nada de esto está hecho**: el dueño pidió no empezar todavía y hacerlo otro día, cerca del reinicio del límite semanal. Sale de seis investigaciones de solo lectura (no se corrió el juego) y de las mediciones guardadas en `build/web/datos/` y en la bitácora.

**Versión 2 (el mismo día).** El dueño preguntó si con la lista se llegaba a todos los objetivos. La respuesta honesta fue no: lo medido es de los aparatos más rápidos (Ryzen 7 9800X3D y Oppo Find X9 Pro), el juego usa un solo núcleo y los demás aparatos son 2–9 veces más lentos. Se agregaron la sección «¿Alcanza?», el área N (12 ítems), una fase nueva (la arquitectura, con la puerta A) y la puerta B con los planes C.

**Versión 3 (el mismo día).** El dueño pidió más ambición: que la gama media también llegue a 60, atacando la CPU, la tarjeta y el «un solo núcleo»; y avisó que solo se prueba con este PC (varios Chrome) y el Oppo. Se agregaron el área H (13 ítems: el aparato de mentira, el presupuesto por pieza, la CPU y la tarjeta en paralelo, el mapa de hilos, la memoria de la Wii fija y ya dada vuelta, la multiplicación-suma del aparato, la tarjeta del Oppo a 2 ms), la tabla de presupuesto y el diagrama de hilos; se ajustaron N2, V7, M11, las reglas y las fases 0, 3, 6, 7 y 8.

**Versión 4 (2026-10-31).** Del 27 al 31 se hicieron 58 ítems y los resultados del motor fueron chicos: el dueño los juzgó «bien tristes». La estimación del techo (`docs/techo-pasos.md`) dio que todo lo que quedaba del plan, siendo realista, bajaba el hilo del juego solo **×1,5** (×2,5 en el mejor caso, contra una meta de ×3,4): llegaban a 60 este PC, el PC típico y probablemente el teléfono tope, pero no la gama media ni la baja. El dueño pidió soluciones más grandes («piensa más grande»: ¿una decompilación en vez de la traducción?) y revisar KartPad, que corre el mismo traductor nativo en teléfonos de verdad. Salieron cuatro documentos (`docs/soluciones-motor.md`, `soluciones-arquitectura.md`, `soluciones-decompilacion.md` y `kartpad.md`), y con ellos el dueño aprobó rehacer el plan («rehace el plan entonces»). La versión 4: dos semanas de **pilotos con umbral de éxito y de corte** (etapa 0); **el dibujo en otro núcleo**, porque la carrera nunca lee lo que el dibujo escribe (etapa 1); **el motor** donde de verdad cuesta (etapa 2); **simular a 60 y dibujar a 30** con la imagen intermedia (etapa 3); **islas decompiladas** solo si los pilotos pasan (etapa 4); las salas (etapa 5) y la página y la prueba final (etapa 6). Se agregó el área W (18 ítems) y se descartaron 15 ítems viejos (los arreglos de a una función, las variantes de la multiplicación-suma, las pasadas que agrandan el código, el paso 10 de la tarjeta). **La meta por escalón (estimada):** PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados, al borde; teléfono de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC (N11). KartPad mostró que ni nativo un teléfono de gama media llega a 60 (Dimensity 7300 ~29 ms, Helio G85 ~45 ms con 12 karts) y que PGO le dio −12 %.

**La poda (2026-10-31 23:10).** El dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo». Cada ítem abierto se quedó solo si gana ~2 % o más del hilo del juego en la gama media o baja, si otro ítem que se queda lo necesita para medirse, o si arregla algo que un jugador notaría. Salieron 18 (paso 17 de la historia): los hilos con memoria compartida y la CPU con la tarjeta en paralelo (H3, H4, N4, G9, P9: los contiene W10 o no ganan porque la tarjeta no frena), la aurora nueva (N15b), lo que ya cubre otro ítem (M9, W18, M11), lo que con el juego en un Worker o sin pedidos en la carrera no toca el cuadro (P1, P2, D10, D11), y lo que no es rendimiento (U4, E1, E2, D7, D14). N15 quedó hecho (N15a era la parte que se usa). Lo ya escrito de E1, E2 y P9 sigue en el código, apagado detrás de su bandera.

Al retomarlo: (1) leer «¿Alcanza?», la «Respuesta corta» y el «Orden de trabajo»; (2) empezar por la etapa 0 (los pilotos que deciden); (3) cada ítem trae «Dónde» con archivo:línea de cuando se escribió, que puede haberse movido: verificar antes de tocar; (4) documentar cada paso en `docs/bitacora.md` (glosario incluido) y marcar el avance en `PLAN.md` con fecha y hora, como siempre; (5) las reglas de CLAUDE.md siguen valiendo, en especial: nunca menos karts ni efectos, el producto es siempre la página, nada del juego a git (tampoco lo decompilado), los fantasmas iguales bit a bit, R2/Worker/Firebase los publica el dueño, y PR solo con su confirmación de cada vez.

El orden de trabajo (las 7 etapas de la versión 4, con lo que tarda cada una, y debajo los pasos viejos como historia) y las casillas de «Avance» van al final. Al terminar cada ítem o criterio: marcarlo en `herramientas/plan-rendimiento/avance.mjs` (estado, fecha y hora, dónde se documentó), regenerar y volver a publicar la página; además `PLAN.md` y la bitácora, como siempre.

El .md y la página salen del generador en `herramientas/plan-rendimiento/` (`node herramientas/plan-rendimiento/generar.mjs docs/plan-rendimiento.md <salida.html>`): si el plan cambia, editar los datos de esa carpeta, regenerar y volver a publicar el artifact.

## Lo que pidió el dueño

- «Optimizar al máximo el performance de este juego para que la experiencia multiplayer sea perfecta y fluida en 60 fps incluso entre PC y móviles.»
- «1) La factibilidad de hacerlo asíncrono el multiplayer, de tal manera que los fps de un jugador no afecten a otro.»
- «2) La optimización máxima en PC y móviles para que corra a 60 fps el multiplayer con 12 jugadores y/o CPU… quizás necesites decompilar más el juego… y tengamos que subir el R2 otra vez.»
- «3) Que antes de iniciar la carrera todo lo que va a necesitar esté ya descargado: hoy se descargan cosas mientras va la carrera y laguea.»
- «4) Al cargar por primera vez el juego se laguean todos los navegadores, o al descargar algo también, y se congelan los PCs de todos.»
- «Piensa en más cosas que pasan y pueden pasar: ármame una lista extensiva de cosas que arreglar.»
- «No solo el multiplayer va mal, el singleplayer también.»
- «Agrega las posibles causas solo mirando código, sin correr nada, y cómo mejorarlas.»
- «Si es necesario reescribir o usar otras cosas, considéralo: también el engine, WebAssembly, Emscripten, aurora… cuestiona todo, también Firebase, Cloudflare, WebRTC.»
- «No empieces a realizar los cambios todavía»: se hacen otro día, cerca del reinicio del límite semanal.
- «Sinceramente, con estos cambios, ¿crees que se llegará a todos los objetivos? Si no, hay que reformular de manera más profunda.» (versión 2)
- «Quizás ser más ambicioso para que la gama media también… normalmente hay cuellos de botella en GPU y CPU; dices que corre en un solo núcleo, ¿se podría mejorar? Hay que hacer más ambicioso el plan para asegurar.» (versión 3)
- «Recuerda que no podemos probar con múltiples dispositivos: lo máximo es muchos Chrome abiertos, o Chromes + un celular.»
- Los resultados de la versión 3, «bien tristes»; «piensa más grande… ¿podría una decompilación, no una recompilación estática, arreglar todos nuestros problemas?»; «revisa también kartpad»; y, con los documentos del 2026-10-31 en la mano, «rehace el plan entonces». (versión 4)

## ¿Alcanza? La respuesta honesta

**Con la versión 4 (todo estimado): el PC típico y el portátil, 60 dibujados; el teléfono de gama media, 60 dibujados, al borde; el de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC. Ninguna de esas cifras está medida: por eso la versión 4 empieza con dos semanas de pilotos que las confirman o las bajan.**

**Por qué hubo que rehacerlo.** La versión 3 ponía la meta de la gama media en el hilo del juego a un cuarto de hoy (3,3 ms en este PC). Del 27 al 31 de octubre se hicieron 58 ítems y lo que tocaba el motor dio poco (la IA en lo caliente ×1,00, la FMA «punto medio» −7,5 % en la gama baja, las hojas en línea −6 %, M1/M2 +5,2 %). Sumando lo que quedaba, siendo realista, el hilo bajaba **×1,5** (`docs/techo-pasos.md`): llegaban este PC, el PC típico y probablemente el teléfono tope; la gama media y la baja, no.

**Qué cambia: la forma, no solo el motor.** (1) **El dibujo en otro núcleo**: la carrera nunca lee lo que el dibujo escribe (R2 lo probó), así que todo el dibujo, también el código del juego que recorre la escena, puede ir a un segundo Worker un cuadro atrás (W10). Es pasar de resistencias en serie (se suman) a ramas en paralelo (manda la más cargada): el hilo de la carrera baja de 11,1 a ~6 ms en este PC. (2) **El motor donde de verdad cuesta**, sin copiar más código en línea: la memoria de la Wii fija y en el orden de la PC, la pila y el contexto, las banderas, PGO (H6, H7, W12–W14, M6). (3) **Simular a 60 y dibujar a 30** con la imagen intermedia, donde no alcance (N8). (4) **Islas decompiladas** (el dibujo en nativo, la colisión y la física del kart), solo si los pilotos de la etapa 0 pasan (W2, W3).

**La regla de oro sigue:** la carrera no se reparte entre núcleos (la Wii tenía un solo procesador y la sala y los fantasmas exigen los mismos bits); siempre 12 karts y todos los efectos; siempre en la página. **La medida también se corrige:** Chrome en Android revisa los límites de la memoria en cada acceso y este PC no; desde ahora la gama media y la baja simuladas lo pagan (W5, +16 % medido en §160). Y KartPad (el mismo traductor, nativo en teléfonos reales) confirmó que la escalera simulada estaba bien calibrada, si acaso algo pesimista.

| Objetivo | Con lo que quedaba de la versión 3 (realista, ×1,5) | Con la versión 4 (estimado) | Lo que ningún plan arregla |
|---|---|---|---|
| 1. Que el fps de uno no frene a otro | Sí: el árbitro y saltarse el dibujo sin cambiar la carrera ya están hechos y probados (R1, R2). | Igual, con la imagen intermedia para el que dibuja 30 (N8) y el video desde un PC para el teléfono que no simula 60 (N11). | El aparato que no simula 60 cuadros por segundo queda fuera de la carrera: no frena a nadie, pero no corre (salvo por video). |
| 2. 60 fps con 12 karts, en PC y celular | Este PC, el PC típico (justo) y probablemente el teléfono tope. El portátil, la gama media y la baja, no (`docs/techo-pasos.md` §3). | PC típico y portátil: 60 dibujados. Teléfono de gama media: 60 dibujados, al borde (si no entra, 60 de carrera con 30 dibujados y la imagen intermedia). Gama baja: 60 de carrera con 30 dibujados y la imagen intermedia; en la sala, el video desde un PC (W10, W17, N8, N11). | La gama baja con 60 dibujados no la alcanza nada que corra en la página: ni siquiera KartPad, nativo, pasa de 20–29 fps en un Helio G85. El aviso (N12) para lo que aun así no llegue. |
| 3. Todo bajado antes de la carrera | Hecho: el paquete de carrera, sin descargas de fondo y con una versión por archivo (D1, D2, D5). | Igual. | Con una conexión lenta, la carrera espera al que baja (o larga sin él). |
| 4. Nada se congela al cargar | Casi: tope al precalentado y freno a las descargas (C1, C4); queda una traba de ~300 ms al largar en un PC de 4 núcleos (V8 optimizando). | Sí: el juego en su propio Worker y fuera del hilo de la página (N3), y el código caliente más chico con PGO (W4, H11). | La 1.ª visita baja ~100 MB y compila 108 MB de código: un PC débil trabaja un minuto, aunque sin congelarse. |
| Un jugador | Igual que el punto 2, sin la red. | Igual que el punto 2, sin el video (que es solo de la sala): la gama baja juega con 30 dibujados y la imagen intermedia. | Igual que el punto 2. |

### La escalera de aparatos

Cuánto tarda el hilo del juego por cuadro en cada escalón: hoy, con lo que quedaba de la versión 3 (realista, `docs/techo-pasos.md` §3) y con la versión 4. S es cuántas veces más lento es todo el hilo que en este PC, sacado de la escalera calibrada en el tramo fijo (§163–§164); en la versión 4, los teléfonos además pagan la revisión de límites de Android (W5, +16 %). Solo la fila de este PC está medida; el Oppo, como referencia del 2026-10-30, ya no se mide. Con la versión 4 hay dos números: **el hilo de la carrera** (decide si se simulan 60 cuadros por segundo) y **el del dibujo** (decide cuántas imágenes), cada uno en su núcleo. Todo lo de la versión 4 es **estimado** (de `docs/soluciones-arquitectura.md` §7 y `docs/soluciones-decompilacion.md` §1.5, con la etapa 4 incluida) y lo confirman o lo bajan los pilotos de la etapa 0. KartPad, nativo en teléfonos reales, cae en el mismo lugar que la escalera simulada o un poco mejor (`docs/kartpad.md` §2).

| Aparato | Ejemplos | S: veces más lento que este PC | Hoy, un jugador (ms) | Con lo que quedaba de la v3 (realista) | Con la versión 4: carrera / dibujo (estimado) | ¿60 en el navegador? |
|---|---|---|---|---|---|---|
| PC para juegos reciente | Ryzen 7000–9000, Intel 13.ª–14.ª; el PC del proyecto (9800X3D) | 1 | 10,8–11,4 (medido, §166.5) | ~7,5 | 3–4 / 2–3 | Sí (ya hoy) |
| PC típico (2018–2021) | Ryzen 5 3600, Core i5-10400 | ~2 | ~22 | ~15 | 6–8 / 4–6 | Sí: 60 dibujados (estimado) |
| Portátil de oficina | Core i5 de bajo consumo, 8.ª–11.ª generación | ~4,4 | ~45–50 | ~33 | 13–17 / 9–13 | Sí: 60 dibujados (estimado; con la etapa 4) |
| Teléfono tope de gama 2024–25 | Oppo Find X9 Pro, Snapdragon 8 Elite | ~1,5–2,5 | 12,5 «juego» en régimen (§114) | ~11–19 | 5–9 / 3–7 | Sí: 60 dibujados (estimado) |
| Teléfono de gama media | Galaxy A5x, Dimensity 7300, Exynos 1480 | ~5–5,7 | ~50–63 | ~38–43 | 16–19 / 11–16 | 60 dibujados, al borde (estimado); si no entra, 60 de carrera con 30 dibujados y la imagen intermedia (N8) |
| Teléfono de gama baja | Galaxy A1x, Redmi, Helio G85–G99 | ~8,3 | ~92 | ~62 | 17–22 / 17–25 | 60 de carrera, al borde, con 30 dibujados y la imagen intermedia (N8); en la sala, el video desde un PC (N11) (todo estimado) |

Un jugador, 12 karts. Gris: el hilo del juego hoy (dibujando todo). Color: con la versión 4, el hilo de la carrera (el dibujo va en otro núcleo y entra en 16,7 ms en todos los escalones salvo la gama baja, que dibuja a 30) (verde entra en 16,7 ms, ámbar al borde, rojo no entra). Barra llena = medido; borde punteado = estimado. La tarjeta de video no frena en ningún escalón simulado (0,2–3,3 ms por imagen, §164).

### El presupuesto de la versión 4, pieza por pieza

Cada pieza con su núcleo y su meta (H2). La columna de hoy es este PC, del perfil de la carrera de §160 reagrupado por partes del cuadro (`docs/soluciones-arquitectura.md` §0), escalado a los 11,1 ms de §166.5. La meta se mide en este PC como CPU pura en el tramo fijo (§163) y, con el aparato de mentira de la gama media (S ≈ 5,4) y la revisión de límites de Android (W5), cada hilo tiene que entrar en 16,7 ms: en la gama media la versión 4 llega **al borde**, sin el margen de 12 ms que pedía la versión 3. Si el hilo del dibujo no entra, dibuja 1 de cada 2 y la imagen intermedia completa los 60 (N8). Todo lo que no es «hoy» es estimado.

| Pieza | Dónde corre | Hoy en este PC (medido, §160 y §166.5) | Meta de la versión 4 en este PC (tramo fijo) | En la gama media simulada (S ≈ 5,4, con la revisión de límites) | Con qué |
|---|---|---|---|---|---|
| Worker A: la carrera (física, IA, objetos, cámaras) | un núcleo grande | 4,2 ms (el hilo entero: 11,1) | ≤ 3 ms (la carrera más el borde de las islas) | ≤ 16,7 ms (estimado: 16–19, al borde) | W2 W17 H6 H7 W12 W13 W14 M6 |
| Worker B: el dibujo del juego, aurora y presentar | otro núcleo grande | 2,8 + 0,95 ms (dentro del mismo hilo) | ≤ 3 ms con el dibujo nativo | ≤ 16,7 ms, o 1 de cada 2 con la imagen intermedia | W10 W15 W16 N8 |
| Lo que solo se ve de la parte de calcular (efectos, qué suena, la interfaz) | el Worker B | 0,72 ms (dentro de la carrera) | 0 en A (se mueve a B) | — | W11 W16 |
| Sonido | el AudioWorklet o el Worker B | ~0,6 ms (el hilo de sonido del juego) | 0 en A | ≤ 3–5 ms fuera del hilo de la carrera | W11 P5 |
| Chrome y la página (`(program)`, Blink, el compositor, la interfaz) | el hilo principal | ~2,6 ms (lo que queda del hilo) | ≤ 1 ms en A | ≤ 3–4 ms en el hilo principal | N3 P10 |
| La tarjeta de video | la tarjeta | 0,2 ms en este PC; 1,2–1,5 en la gama media simulada (§164) | que no frene | no frena en ningún escalón simulado | W15 (vuelve a medirla) |
| Procesador y tarjeta juntos | — | en serie dentro del mismo cuadro | en paralelo: manda la mayor | 60 fps | W10 |

Un cuadro repartido en núcleos, meta para la gama media: Núcleo grande 1 · Worker A (la carrera, con el motor y las islas, 16,2 ms); Núcleo grande 2 · Worker B (el dibujo nativo y presentar, 13,5 ms); Núcleo chico · sonido (la mezcla del sonido, 4 ms); Hilo de la página (interfaz, mandos, red, 3 ms); Tarjeta · el cuadro anterior (dibuja el n−1 mientras se calcula el n, 2 ms).

Un cuadro en un teléfono de gama media, a escala (estimado, S ≈ 5,4 sobre el reparto de este PC). Arriba, hoy: todo en un solo núcleo y en fila, unos 60 ms por cuadro; la tarjeta, poca cosa. Abajo, la meta de la versión 4: la carrera en el Worker A y el dibujo en el Worker B, en paralelo; la carrera queda **al borde** de los 16,7 ms. Si el Worker B no llega, dibuja 1 de cada 2 y la imagen intermedia completa los 60 (N8). Se comprueba con el aparato de mentira (H1) y la revisión de límites (W5).

**El techo del navegador, medido.** El mismo juego como programa de Windows corre ×2,45–2,63 más rápido que en wasm (§165, §166), y ese impuesto está **repartido parejo** en 1.886 funciones: no hay un punto caliente que cambiar (§181.2). Es como un conductor más fino en todo el cableado: la caída está en cada metro. Por eso no ganó reescribir funciones de a una (N14), ni las variantes de la multiplicación-suma, ni copiar más código en línea (que en la gama baja pierde porque llena la caché de instrucciones).

**Lo que sí puede ganar** (`docs/soluciones-motor.md`): sacar operaciones de lo que más se repite y **achicar** el código: la memoria de la Wii en un lugar fijo y en el orden de la PC (1,1 millones de accesos por cuadro, de ~13–15 operaciones a ~3–4: H6, H7), la pila en variables locales (W12), el contexto en una dirección fija (W13), las banderas perezosas (W14) y PGO (W4, M6). Todo junto, el código traducido ×1,5 realista y ×2,1 optimista; como es ~62 % del hilo, solo no alcanza. **Lo que cambia la cuenta es la forma**: el dibujo en otro núcleo (W10) y dibujar a 30 donde haga falta (N8). Y para lo que siga caliente, **islas decompiladas** con sus datos nativos (W15–W17), si los pilotos lo aprueban.

**Lo que ningún plan arregla en la página.** KartPad, nativo, no llega a 60 en un Dimensity 7300 (~29 ms) ni en un Helio G85 (~45 ms) con 12 karts (`docs/kartpad.md`). La gama baja con 60 **dibujados** queda fuera: su camino es 60 de carrera con 30 dibujados y la imagen intermedia (N8), y en la sala el video desde un PC (N11); decirlo (N12) para lo que aun así no llegue. La app nativa quedó descartada (N10): el producto es siempre la página.

### Qué cambia en el plan

- **Etapa 0, pilotos que deciden (2 semanas)**: el sumidero y las páginas sucias (W1), la isla de la colisión (W2), un modelo dibujado en nativo (W3), PGO (W4), la simulación del teléfono con la revisión de límites (W5) y dos medidas del nativo (W6); cada uno con su umbral de éxito y de corte. Los arreglos de KartPad, temprano (W7–W9).
- **Etapa 1, el dibujo en otro núcleo**: A1-s (W10) y A2 (W11), con lo que quedaba de los pasos 8 y 9 viejos.
- **Etapa 2, el motor**: H6 + H7 (la parte 1a primero), PGO (M6, M7, H11), la pila (W12), el contexto (W13) y las banderas (W14).
- **Etapa 3, simular a 60 y dibujar a 30** con la imagen intermedia, en el Worker del dibujo (N8).
- **Etapa 4, las islas decompiladas, solo si pasan los pilotos**: D-a y D-b con los efectos (W15, W16), la colisión y la física del kart (W17). En paralelo con el motor.
- **Etapa 5, las salas**: el video desde un PC para la gama baja (N11) y lo que quedaba (R4). **Etapa 6**: la página liviana y la prueba final.
- **Lo que sale**: reescribir de a una función (M4, H9, N7), las variantes de la multiplicación-suma (M5, H8), las pasadas que agrandan el código (M8, N5), lo que pesa menos del 3,5 % (M3, M10), el paso 10 de la tarjeta (N9, G7, G10, H13) y lo que reemplazan las islas (N6, H10).
- **La poda (2026-10-31 23:10)**, el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo». Salen 18 más: los hilos con memoria compartida y la CPU con la tarjeta en paralelo, que W10 ya contiene o que no ganan porque la tarjeta no frena (H3, H4, N4, G9, P9); la aurora nueva (N15b); lo que ya cubre otro ítem (M9, W18, M11); lo que con el juego en un Worker o sin pedidos en la carrera no toca el cuadro (P1, P2, D10, D11); y lo que no es rendimiento (U4, E1, E2, D7, D14).

## Respuesta corta

### 1. ¿Se puede hacer el multijugador asíncrono, que el fps de uno no afecte a otro?

**Sí, en lo que importa: con un árbitro y la simulación separada del dibujo.** Asíncrono del todo (cada uno a su ritmo y la misma carrera en todas las pantallas) no existe sin rollback, y el rollback aquí es imposible (el estado son 88 MB o más y los hilos del juego no se pueden guardar). Pero se logra que **el lento no frene a nadie** con dos piezas: **el árbitro** (la PC más estable fija en cada cuadro los botones de todos y nadie espera a nadie más que a ella) y **simular a 60 aunque se dibuje menos** (el teléfono que dibuja a 30 sigue simulando a 60).

Lo único que ningún modelo arregla es un aparato que no puede simular 60 cuadros por segundo ni sin dibujar: con el árbitro eso lo paga solo él (queda fuera de esa carrera). Riesgo conocido: RR ya se salta dibujos cuando va atrasado, y en la sala eso separaba la carrera (§85.4); el dibujo le deja algo a la lógica que hay que encontrar (R2). El en línea de la Wii (RKNet) costaría 6–12 semanas, no tiene CPU y cada pantalla vería una carrera algo distinta. Fase 4: R1, R2, G1.

### 2. ¿60 fps con 12 karts en PC y celular?

**Con la versión 4 (estimado): PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados, al borde; teléfono de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC. Antes de meterle meses, dos semanas de pilotos lo confirman o lo matan.** Con todo lo que quedaba de la versión 3, siendo realista, el hilo del juego bajaba solo ×1,5 (`docs/techo-pasos.md`): no alcanzaba para la gama media ni la baja. Y KartPad, que corre el mismo traductor **nativo** en teléfonos de verdad, lo confirma: con 12 karts, un Dimensity 7300 (gama media) tarda ~29 ms por cuadro y un Helio G85 (gama baja) ~45 ms, sin navegador (`docs/kartpad.md`).

La versión 4 cambia la forma: **el dibujo entero a otro núcleo**, un cuadro atrás, porque la carrera nunca lee lo que el dibujo escribe (W10, W11); **el motor** donde de verdad cuesta (la memoria de la Wii, la pila, el contexto, las banderas, PGO: H6, W12–W14, M6); **simular a 60 y dibujar a 30** con la imagen intermedia (N8); e **islas decompiladas** (el dibujo en nativo, la colisión y la física del kart: W15–W17), solo si los pilotos de la etapa 0 pasan sus umbrales (W1–W4). Siempre 12 karts y todos los efectos, siempre en la página. Detalle en «¿Alcanza?».

### 3. ¿Todo descargado antes de la carrera?

**Sí: un paquete de carrera, bajado antes de la cuenta.** Hoy se baja durante la carga y también en plena carrera (la última vuelta, la meta). La sala ya sabe la pista y los 12 puestos antes de largar, así que se puede armar un paquete (pista, música, karts, voces, fanfarrias), bajarlo durante los 45 s de elección o en el descanso y dejarlo fijo en memoria hasta la meta (D1); en un jugador, en el gancho que ya existe al armar la carrera.

Hay que grabar `carreras.json` y subirlo a R2, con una versión por archivo (D5) para que cada subida no borre la caché de todos. Y mientras se corre, cero descargas de fondo (D2). Lo único que no se arregla: con una conexión lenta, la carrera espera al que baja (o larga sin él).

### 4. ¿Por qué se traban todos los navegadores y el PC al cargar?

**Por el proceso de GPU de Chrome, inundado de pipelines, más descargas sin freno.** Chrome tiene **un solo proceso de GPU** para todas las pestañas y ventanas. El precalentado le pide 730–930 pipelines en 1–2 s, sin tope, y Dawn los compila usando todos los núcleos: en un PC de 4 núcleos serían 30 s o más al 100 %, y mientras tanto ese proceso también tiene que componer las demás pestañas. Encima se bajan unos 205 MB en el primer minuto (hasta 90 Mbit/s) y V8 compila 108 MB de código.

El arreglo más barato ya existe en C++ y es solo de la página: el precalentado con tope, por omisión (C1), más un freno a las descargas (C4). Fase 1, sin recompilar ni subir nada.

En la sala, «se congelan los PCs de todos» también es el lockstep: la traba de uno frena a todos, y eso lo arregla el árbitro (R1). Con el juego en su propio proceso y fuera del hilo de la página (N3), la página deja de congelarse del todo. Lo que queda: la 1.ª visita siempre baja ~100 MB y compila 108 MB; un PC débil trabaja un minuto, aunque sin congelarse.

### 5. ¿Y un jugador?

**Va mal por lo mismo, menos la red, y vale la misma escalera de aparatos.** Un jugador comparte la carga, las descargas, el motor, los gráficos y la página. Lo propio: el precalentado se mete en la 1.ª carrera (U1), los karts de las CPU se piden de a uno (D4) y «30 fps» puede ser la lógica a 60 dibujando la mitad: falta contar los cuadros de lógica (V5). Contrarreloj sirve para separar causas (U3). Las 11 CPU se simulan en el aparato igual que en la sala, así que vale la misma escalera: con todo el plan, también la gama media si se cumplen las dos metas del presupuesto (H2). La interpolación (N8) sirve en un jugador desde ya.

### 6. ¿Hay que reescribir algo o cambiar de herramientas?

**Sí, más que antes: el dibujo pasa a otro Worker, la memoria de la Wii cambia de forma y, si los pilotos lo aprueban, partes calientes del juego se decompilan por islas. La base (WiiCompiled), WebGPU y la malla se quedan.** Se queda la base: WiiCompiled traduce el juego entero, y solo un binario traducido respeta los parches de RR por dirección (decompilar el juego entero serían 18–30 meses y el 94 % de las funciones casi no corre en la carrera: `docs/soluciones-decompilacion.md`). Cambia la arquitectura: el juego en un Worker (N3) y **el dibujo en un segundo Worker**, con las páginas sucias transferidas en cajas (W10); la memoria de la Wii en un lugar fijo y en el orden de la PC (H6, H7); la pila y el contexto sin pasar por la memoria (W12, W13).

Lo que se reescribe: **islas** enteras, no funciones sueltas (de a una ya se probó y no gana, N14): el renderizador WebGPU propio con los efectos (W15, W16), la colisión y la física del kart (W17). Es código derivado del de Nintendo: nunca a git, servido privado desde R2 como el traducido. De la infraestructura: el Worker de Cloudflare y Firebase se quedan como están; la app nativa quedó descartada (N10): el producto es siempre la página. Detalle en «Cuestionar todo».

## Dónde se van los 16,7 ms (lo medido)

A 60 fps cada cuadro tiene **16,7 ms**, como el período de una señal de 60 Hz. Todo corre en **un solo hilo** y en fila: la lógica del juego, el dibujo del juego, aurora (que lo traduce a WebGPU), la mezcla del sonido y la página. Si la suma pasa de 16,7 ms el cuadro llega tarde, y si pasa de 33,3 se ve a 30.

En el PC sobra margen fuera de la sala. En la sala va al borde por «todo a la vista» (la sincronía obliga a dibujar todo). En el teléfono de gama alta la CPU entra, pero la tarjeta tarda 34 ms por imagen y por eso se ve a 30; además el arranque y la 1.ª carrera no entran. Y en el teléfono los dos números del informe («juego» y «tarjeta») se contienen el uno al otro, así que todavía no se sabe bien qué parte es CPU y qué parte es GPU (V1).

Ojo con la escala: el PC es un Ryzen 7 9800X3D y el teléfono un Oppo Find X9 Pro, los más rápidos de su clase. Lo que pasa en los demás aparatos está en «¿Alcanza?».

| Caso | ms por cuadro | Fuente |
|---|---|---|
| PC (Ryzen 7 9800X3D), carrera fuera de la sala | 7,0–9,5 | §54, §85; `medir-sitio/pedidos-lote3-pc` (7,23; p95 9,7) |
| PC en la sala (dos pestañas en el mismo PC) | 15–17 | §85; `datos/sala/registro.txt` (12,7–18) |
| PC con la CPU frenada ×4 (simula un PC débil; exagera) | 56,3 (17,7 fps) | §54 |
| Oppo Find X9 Pro, en régimen | 12,3–12,6 | §114 |
| Oppo, primeros ~21 s de la 1.ª carrera | 27–48 | §114 |
| Oppo, 2.º informe (30 s) | juego 33,4 / tarjeta 33,8 | §115 |
| Oppo con la vista más angosta | 20 | §115.5 |
| Teléfono de gama media (×2,8–3,8 el Oppo) | 35–48 | estimado (ver «¿Alcanza?») |

Reparto en PC (§85):

| Parte | Fuera de la sala | Sala |
|---|---|---|
| `RaceScene::OnCalc` (la lógica) | 3,1 ms | 4,3 ms |
| `ScnMgr::DrawMain` (el dibujo del juego) | 2,1 ms | 6,4 ms |
| … de eso, `RendererRaceModels::Draw` (los karts) | 1,5 ms | 5,6 ms |
| Lo demás: 2D, efectos, sonido y fin de cuadro de aurora | ~4 ms | sin medir aparte |
| La página (JavaScript) | menos de 0,1 ms | sin medir (lockstep) |

## ¿Multijugador asíncrono?

**Hoy** la sala es un lockstep: las 12 consolas simulan exactamente la misma carrera y, para correr cada cuadro, cada una necesita los botones de todos los humanos para ese cuadro. Es una cadena de compuertas AND: el cuadro avanza cuando llegaron todas las entradas, así que el más lento marca el paso. Los arreglos de hoy (relevo, sincronía, ponerse al día) achican el daño: una traba de 1,5 s cuesta 34–322 ms a los demás.

**Asíncrono del todo** (cada uno a su ritmo y la misma carrera en todas las pantallas) no existe sin rollback, y el rollback aquí es imposible. Pero sí se puede lograr lo que importa, **que el fps de uno no frene a nadie**, con dos piezas juntas:

- **El árbitro:** la consola más estable fija en cada cuadro los botones de todos. Las demás esperan solo a ella, como osciladores enganchados por PLL a un reloj maestro. Si los botones de un jugador no le llegan a tiempo, el árbitro repite el último y la carrera sigue.
- **Simular a 60 aunque se dibuje menos:** cada aparato corre siempre 60 cuadros de lógica por segundo y dibuja los que alcanza. El teléfono que dibuja a 30 sigue en la misma carrera y a tiempo.

Lo que ningún modelo arregla: un aparato que no puede **simular** 60 cuadros por segundo ni siquiera sin dibujar. Con el árbitro eso lo paga solo él (se atrasa o queda fuera de esa carrera), no la sala. Por eso lo primero es medir cuánto tarda el teléfono en simular sin dibujar (V1).

| Opción | Qué es | Veredicto | Esfuerzo |
|---|---|---|---|
| Lockstep de hoy (malla) | cada consola espera los botones de todas en cada cuadro; relevo y sincronía como arreglos | **Queda de respaldo.** — Funciona y está probado, pero la traba de uno les cuesta 34–322 ms a los demás. | ya está |
| Árbitro (el relevo como modo normal) | la PC más estable fija los botones de todos en cada cuadro; cada uno manda los suyos solo al árbitro y a un suplente | **Recomendado.** — Nadie espera a nadie más que al árbitro. El formato ya existe. Cuesta +1–2 cuadros de retraso y 2–3 Mbit/s de subida para el árbitro. | ~1 semana |
| Simulación a 60 separada del dibujo | cada aparato simula siempre 60 cuadros por segundo y dibuja los que alcanza | **Recomendado: es la pieza clave.** — El que dibuja a 30 no frena a nadie ni se atrasa. Hay que decompilar lo que el dibujo le deja a la lógica (`ModelDirector::Update`, la visibilidad). | 1–1,5 semanas |
| Rollback (estilo GGPO) | cada uno corre adelantado y corrige cuando llegan los botones | **Descartado.** — El estado son 88 MB o más y los hilos del juego son fibras con pila nativa suspendidas por JSPI: no se pueden guardar ni restaurar. Copiar 88 MB tarda 9–30 ms y re-simular 3 cuadros en el teléfono unos 37 ms. | — |
| RKNet (el en línea de la Wii) | cada consola simula su kart y manda su estado; los demás se ven interpolados | **No por ahora.** — No tiene CPU (habría que extender paquetes y tablas), exige armar la carrera sin WFC y cada pantalla ve una carrera algo distinta. | 6–12 semanas |
| Un servidor que corre el juego | un servidor simula y les manda la carrera a todos | **No.** — Habría que correr 128 MB de wasm a 60 Hz por sala en un servidor, y sacar el ejecutable traducido de Nintendo de R2 privado. | — |
| Video desde un PC de la sala (plan C2) | un PC de la sala dibuja también la vista del teléfono débil y se la manda en video | **A investigar, solo para teléfonos que no simulan a 60.** — Cualquier teléfono a 60, a cambio de 30–50 ms más de demora y de la subida del PC (N11). | 3–5 semanas |

Orden recomendado: medir el teléfono (V1) y ampliar la huella (R5) → separar la simulación del dibujo (R2) → el árbitro como opción (R1) → probar PC con celular (R6). Son 2–3 semanas, en la fase 4.

## Cuestionar todo: capa por capa

Pediste cuestionar todo. Esta tabla revisa cada capa del proyecto, del motor a la infraestructura, y dice qué hacer con ella: **mantener**, **mejorar**, **cambiar**, **probar**, **no** o **después**. La regla para cambiar algo: que gane en los números y que no rompa la sala ni los fantasmas.

| Capa | Hoy | Veredicto | Por qué | Costo |
|---|---|---|---|---|
| Motor: traducción estática (WiiCompiled) | PowerPC → C++ → wasm | **Mejorar** | Es exacta en coma flotante (paridad 22/0) y RR/Pulsar parchea el juego por direcciones: solo un binario traducido respeta eso. Dolphin en wasm solo existe como demo (traduce mientras corre: siempre más lento) y un port desde la decompilación pública (doldecomp/mkw va en 5,8 %) obliga a rehacer cada parche de RR. La versión 4 ataca lo que de verdad cuesta en wasm: la memoria de la Wii, la pila, el contexto, las banderas y PGO (H6, W12–W14, M6). | semanas |
| Decompilar por islas (versión 4) | no se usa | **Probar** | Decompilar el juego entero no conviene (18–30 meses y el 94 % casi no corre en la carrera), pero una **isla** entera con sus datos en formato nativo podría correr ×2–2,5 más rápido. Primero los pilotos de dos semanas con su umbral (W2, W3); si pasan, el dibujo en nativo y la física (W15–W17). Lo decompilado es derivado del código de Nintendo: nunca a git, solo dentro del `.wasm` privado de R2. | meses |
| Física propia (Kinoko) | no se usa | **No** | Reimplementa la física de Contrarreloj (55 de 55 fantasmas cuadro a cuadro), pero no trae objetos, CPU, en línea ni los cambios de RR. Sirve como referencia para validar, no para reemplazar. | — |
| WebAssembly: SIMD128 y JSPI | en uso | **Mantener** | SIMD128 dio −13 % en los menús; JSPI deja al juego esperar sin instrumentar todo (Asyncify sale más grande y más lento). Probar branch hints (Chrome 137) y tail calls. Nada de fast-math ni memory64; SIMD relajado solo para la multiplicación-suma, probada fusionada al arrancar (H8, M11). | — |
| Partir el módulo (wasm-split) | un `.wasm` de 128 MB | **Después** | Ayuda a la 1.ª carga y a la memoria de teléfonos chicos, no al cuadro. Es experimental: una función que falta se carga en plena carrera y de forma síncrona (Chrome no compila más de 8 MB síncronos en el hilo principal): tirón y, en la sala, espera del lockstep. | semanas |
| Emscripten 6.0.12 | `-O2`, sin LTO, MEMFS, dlmalloc | **Mejorar** | `-O3` y `wasm-opt` no ganaron (§54). Probar ThinLTO del runtime y aurora (M7) y PGO (M6). mimalloc gana poco: el juego reparte su memoria dentro de la RAM de la Wii. WasmFS: los 6.036 archivos cuestan al arrancar, no por cuadro (C6). | días |
| Hilos (pthreads, memoria compartida) | un solo hilo | **Cambiar** | Usar más núcleos es el multiplicador grande que queda dentro del navegador: un teléfono tiene 8 y el juego usa uno. Pero no hace falta memoria compartida: el dibujo va a un segundo Worker con su propia copia del juego y la cinta de cajas (W10, H5), que anda en cualquier Chrome, también en Android. Con memoria compartida ganaría solo −0,1 a −0,5 ms más y con riesgo alto en Android (`docs/soluciones-arquitectura.md` §7): la poda del 2026-10-31 descartó esa variante (G9, N4, P9). (En la primera versión decía «después»: era un error de escala.) | semanas |
| La carrera repartida en varios núcleos | un hilo, como en la Wii | **No** | La Wii tenía un solo procesador y la carrera es una sola fila de decisiones: repartirla cambia el orden de las cuentas, separa las consolas de la sala y los fantasmas, y gana poco (la física de los 12 karts es solo una parte del cuadro). Se reparte todo lo demás: el dibujo entero a otro Worker, porque la carrera nunca lo lee (W10, W11). | — |
| El dibujo en otro núcleo (versión 4) | en el mismo hilo que la carrera | **Cambiar** | La carrera nunca lee lo que el dibujo escribe (R2 lo probó), así que el dibujo entero, también el código del juego que recorre la escena, va a un segundo Worker un cuadro atrás, con las páginas sucias transferidas en cajas: sin memoria compartida, anda en cualquier Chrome (W10). Es el «dual core» de Dolphin cortado más arriba. Precio: un cuadro de demora y una segunda copia del juego en memoria. | 4–6 semanas |
| aurora (GX → WebGPU) | adaptada a la web por nosotros | **Mejorar** | La traducción del GX es grande y correcta, y se queda para todo lo que no sea caliente. La versión 4 la mueve al Worker del dibujo (W10) y, si el piloto lo aprueba (W3), le saca lo más caro con un renderizador propio para los modelos (D-a, W15). noclip.website (MIT) sirve de referencia para los formatos y los shaders GX. | semanas |
| WebGPU (en vez de WebGL2) | en uso | **Mantener** | aurora ya habla WebGPU, compila los pipelines en paralelo y da timestamp-query. WebGL2 compila los shaders en el hilo de la página y no tiene compute. En Android pide Chrome 121 y Android 12 con GPU Qualcomm o ARM. | — |
| emdawnwebgpu | el puente de C++ a WebGPU | **Mantener** | Es el puente obligado; lo que cuesta es la cantidad de llamadas, y eso baja con G3. | — |
| SDL3 | ventana, sonido y eventos | **Mantener** | No aparece en el perfil. Se pueden quitar los subsistemas que sobran (los mandos ya los maneja la página). | horas |
| Sonido (nw4r::snd, AX, AudioWorklet) | mezcla en el hilo del juego | **Mejorar** | Rehacer el motor de sonido sería rehacerlo todo; el hilo de sonido sale del hilo de la carrera (W11) y el puente deja de crear basura (P5). | días |
| Disco por bloques (MEMFS, lotes, Cache Storage) | perezoso y sin freno | **Mejorar** | La idea está bien; faltan el paquete de carrera, el freno y la versión por archivo (D1, C4, D5). | semanas |
| El marco del juego en GitHub Pages | mismo origen que Juegos | **Cambiar** | Comparte el hilo con el sitio. Con el juego en un Worker (N3, P10) la carrera deja de compartirlo; el «modo juego» del sitio y la página aislada con Document-Isolation-Policy ya no hacen falta y se descartaron en la poda (P2, P9). | semanas |
| El navegador como única plataforma | solo Chrome (escritorio y Android) | **Probar** | Tiene techo, pero más alto de lo que decía la versión 2: la memoria de la Wii y la multiplicación-suma se pueden abaratar dentro de wasm (H6–H8) y los hilos llegan al teléfono (H5). N1 midió el impuesto: ×2,2. Es la única plataforma del producto (el dueño, 2026-10-29: nada de app descargable). | meses |
| Probar en muchos aparatos | el PC (varios Chrome y la emulación de teléfono); el Oppo ya no se mide | **Mejorar** | No hay más aparatos: la gama media y la baja se simulan con lastre de CPU y de tarjeta y un ladrón de caché, calibrados (H1), con metas con margen (H2). La sala de 12, con consolas de mentira (V7). | días |
| Video a los teléfonos débiles | no se usa | **Probar** | Un PC de la sala dibuja también la vista del teléfono y se la manda en video: cualquier teléfono a 60, con más demora (N11). | 3–5 semanas |
| Worker de Cloudflare + R2 | en `workers.dev`, plan gratis | **Mantener** | R2 no cobra la salida y los 5 GB caben gratis. En `workers.dev` no hay caché del borde y el plan gratis da 100.000 pedidos por día: un dominio propio y el plan pago acortarían la carga, pero no el cuadro, y con la carrera andando no se pide nada (§176.3); quedan como opción del dueño en `docs/publicar.md` (D7, D14, descartados en la poda). | — |
| Firebase RTDB (sala, vestíbulo, VR) | en uso | **Mantener** | Solo tiene servidores en EE. UU., Europa y Asia: unos 120–200 ms desde Sudamérica. Sirve para el vestíbulo y la sala; los botones no pasan por ahí. Su SDK trabaja en el hilo de la página de arriba: con el juego en un Worker (N3) ya no le quita tiempo a la carrera. | — |
| Durable Objects (en vez de Firebase) | no se usan | **No** | No hay Durable Objects en Sudamérica (los más cercanos, en el este de EE. UU.): la misma latencia que Firebase. Con botones a 60 Hz se pasaría de la cuota gratis en minutos. | — |
| WebRTC en malla (DataChannels) | 11 enlaces por jugador | **Mantener** | Para 12 es viable (unos 0,7–1 Mbit/s de subida por jugador); el límite es la red del peor. Con el árbitro (R1) bajan los mensajes. Chrome no intercala mensajes: nada grande en la carrera (R8). | — |
| Cloudflare Realtime SFU (DataChannels) | no se usa | **Probar** | Cada uno sube una sola vez (no 11): bueno para la subida de un teléfono. Desde agosto de 2026 acepta canales sin orden ni reenvío. Agrega un salto por Cloudflare (hay que medirlo) y cuesta unos US$0,21 por hora-sala pasados los 1.000 GB gratis al mes. Solo si la subida del árbitro o de los teléfonos no alcanza. | días |
| TURN de Cloudflare («Todo por Cloudflare») | opción apagada | **Mantener** | Solo para quien no conecta directo; agrega latencia. Bien como está: apagado por omisión. | — |
| WebTransport con servidor propio | no se usa | **No** | Es cliente-servidor: hace falta un servidor QUIC propio (los Workers no lo ofrecen) y no gana sobre la malla directa. | — |
| Lockstep | malla: todos esperan a todos | **Cambiar** | Pasar al árbitro (R1) con la simulación separada del dibujo (R2): el lento deja de frenar a los demás. | 2–3 semanas |
| Rollback (estilo GGPO) | no se usa | **No** | El estado son 88 MB o más y los hilos del juego son fibras que no se pueden guardar ni restaurar. | — |
| RKNet (el en línea de la Wii) | no se usa (sala sin WFC, §73) | **No** | No tiene CPU, exige armar la carrera sin WFC y cada pantalla ve una carrera algo distinta. Solo si el teléfono no puede simular a 60 ni sin dibujar. | 6–12 semanas |
| Un servidor que corre el juego | no se usa | **No** | 128 MB de wasm a 60 Hz por sala en un servidor (un Worker tiene 128 MB de memoria y milisegundos de CPU por pedido), y el ejecutable traducido de Nintendo fuera de R2 privado. | — |

## La lista

Prioridad: Urgente = causa el lag o las trabas de hoy; Alta = necesaria para 60 fps estables; Media = mejora o seguridad; Investigar = solo si lo anterior no alcanza.

### W · La versión 4: pilotos que deciden, el dibujo en otro núcleo, el motor y las islas

Esta sección es nueva (versión 4, 2026-10-31). Sale de que los resultados de la versión 3 fueron chicos (el dueño: «bien tristes»): con todo lo que quedaba del plan viejo, siendo realista, el hilo del juego bajaba solo **×1,5** (`docs/techo-pasos.md`). El dueño pidió soluciones más grandes y revisar KartPad, que corre el mismo traductor nativo en teléfonos de verdad.

Cuatro ideas la ordenan. (1) **Pilotos con umbral antes de gastar meses**: cada uno tiene un número que lo aprueba y otro que lo mata (W1–W6). (2) **El dibujo en otro núcleo**: la carrera nunca lee lo que el dibujo escribe (es un «sumidero»), así que el dibujo entero, también el código del juego que recorre la escena, puede ir a un segundo Worker un cuadro atrás (W10, W11). (3) **El motor donde de verdad cuesta**: la memoria de la Wii, la pila, el contexto y las banderas, sin copiar más código en línea (W12–W14). (4) **Islas decompiladas, solo si los pilotos pasan**: el dibujo en nativo primero (no toca la carrera), después la colisión y la física del kart (W15–W18).

El código decompilado es derivado del de Nintendo, igual que el C++ traducido: vive en una carpeta ignorada, nunca va a git ni se publica, y sale solo dentro del `.wasm` privado que el Worker sirve desde R2. Los fantasmas tienen que seguir dando los mismos bits.

#### W1. M0: contar las páginas que ensucia la carrera y probar que el dibujo es un sumidero

*Urgente · PC y celular · Un jugador y sala · 1 semana · Medido · Medir primero · Recompilar el .wasm*

- **Qué pasa:** Toda la etapa 1 descansa en que el dibujo del juego es un **sumidero**: la carrera nunca lee lo que el dibujo escribe. R2 lo mostró en una pista: saltando 1 de cada 2 o 2 de cada 3 dibujos, las huellas dieron 75/75 y el fantasma salió igual byte por byte (§192). Pero no se sabe cuántas páginas de 4 KiB de la memoria de la Wii escribe la carrera en cada cuadro, y de eso depende cuánto cuesta mandarle al dibujo una foto del cuadro (`docs/soluciones-arquitectura.md` §1).
- **Arreglo:** Con la trampa de escritura por página que el runtime ya tiene (la que cuida el código de la Wii) y el vigía (§62): anotar qué páginas escribe la carrera en cada cuadro y cuáles lee el dibujo, en 5–10 pistas (también de Retro Rewind) con 12 CPU. Y la prueba del sumidero: ninguna dirección que escribe el dibujo la lee después la carrera, salvo la parte que R2 conserva (`ModelDirector::Update`, las marcas de «se ve»). Es como un medidor de consumo por circuito: no mira cada electrón, solo anota qué circuitos se usaron.
- **Gana:** decide la etapa 1: con ≲ 2 MB de páginas sucias por cuadro, W10 (sin memoria compartida) es barato; con 10 MB o más, hace falta la versión con memoria compartida
- **Se comprueba:** **Éxito:** el sumidero se cumple en las 5–10 pistas (0 lecturas de la carrera a lo que escribió el dibujo, fuera de lo de R2) y las páginas sucias por cuadro quedan medidas (media y máximo por pista).

**Se corta** W10 tal como está si el sumidero falla en alguna pista (ahí se busca qué lee la carrera, como hizo R2) o si las páginas sucias pasan de 10 MB por cuadro (va la versión con memoria compartida).
- **Dónde:** runtime (tabla de escritura por página); MKW_VIGIA; web/juego/lockstep_nativo.cpp (ScnMgr::DrawMain, R2); docs/soluciones-arquitectura.md §1 y §7

#### W2. Piloto: la colisión con la pista (KCL) como isla decompilada

*Urgente · PC y celular · Un jugador y sala · 1 semana · Sospecha · Decompilar · Recompilar el .wasm · Medir primero*

- **Qué pasa:** No se sabe si la lógica escrita como C++ normal, con sus datos en el orden de la PC, gana de verdad dentro de wasm. Reescribir funciones de a una no ganó nada (N14, §181.2): el impuesto está repartido parejo. La idea de `docs/soluciones-decompilacion.md` es otra: una **isla** entera (un grupo de funciones con sus datos en formato nativo) que solo habla con el resto del juego en su **borde**. La colisión contra el mapa de choques de la pista (KCL) es la isla más chica y cerrada: el mapa no cambia después de cargar; entra una posición y sale el contacto.
- **Arreglo:** Día 1: con el perfil por funciones que ya existe, sumar lo que pesan las consultas de colisión; si es menos del 3 % de la lógica, elegir otra isla cerrada que pese más.

Días 2–5: la IA escribe la isla en C++ propio (tipos de verdad, la multiplicación-suma explícita); el mapa de choques se copia al cargar en formato nativo y el borde convierte la posición que entra y el contacto que sale.

Días 6–7: el comprobador en el borde (el de N14) en cada llamada, una carrera entera de 12 CPU en 3 pistas, los fantasmas y la sala con dos programas; medir con `medir-node-estable --fijo` intercalado y la gama baja en el tramo fijo, con el candado.

Es código derivado del de Nintendo: carpeta ignorada, nunca a git; sale solo dentro del `.wasm` privado de R2.
- **Gana:** saber con un número si decompilar la lógica paga; si pasa, la colisión entra en la etapa 4 junto con la física del kart (W17)
- **Se comprueba:** **Éxito:** 0 diferencias en el comprobador, los fantasmas iguales (`prueba-fantasma-igual`), la sala 75/75 (`prueba-sincro --directa --build-b`) y la consulta (con el borde) **×2,0 o más rápida**, con la ganancia del cuadro de acuerdo con su peso (al menos el 70 % de lo esperado).

**Se mata** la idea de la lógica si la consulta gana **menos de ×1,4** (el impuesto sería de V8 y no de imitar la máquina). Entre ×1,4 y ×2,0: solo las islas de poca multiplicación-suma.
- **Dónde:** build/web/datos/impuesto-perfil/ (perfil por funciones); web/juego/caliente_nativo.cpp (el comprobador); docs/soluciones-decompilacion.md §5 y §8.2

#### W3. Piloto: un modelo de la pista dibujado en nativo

*Urgente · PC y celular · Un jugador y sala · 1 semana · Sospecha · Decompilar · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Dibujar cuesta en la CPU más que la carrera misma: ~6,7 ms por imagen de 11 en este PC (§166.5). G3 y H12 sacaron las subidas repetidas y la CPU no se movió: lo caro no es mandar bytes, es que el juego decida y aurora traduzca cada orden de dibujo del GX, cada imagen. Eso solo se va si el juego deja de hablar GX en lo que se dibuja (`docs/soluciones-decompilacion.md` §2).
- **Arreglo:** El modelo fijo de **una** pista: sus vértices y materiales a la tarjeta al cargar (los materiales TEV ya convertidos en recetas de WebGPU), en un paquete de dibujo ya validado (render bundle), y el dibujo de ese modelo por el juego, apagado. Los karts y todo lo demás siguen por aurora. noclip.website (MIT) muestra que las pistas de Mario Kart Wii se pueden dibujar así en el navegador: sirve de referencia para los formatos, no se copia código.
- **Gana:** saber si el envío nativo (W15) gana de verdad, antes de meterle 6–10 semanas
- **Se comprueba:** **Éxito:** **−0,5 ms o más** de CPU por imagen en este PC (≥ 4,5 %) y ≥ −5 % en la gama baja simulada (tramo fijo, `perfilGpu=1`), con la misma foto (`foto-pantalla.mjs`: menos del 0,5 % de los píxeles con más de 2 niveles de diferencia).

**Se mata** si baja **menos del 2 %**: el costo no estaba en el envío sino en el recorrido de la escena del juego, y habría que ir directo a W16 (meses).
- **Dónde:** aurora lib/gx (command_processor.cpp, shader.cpp); web/navegador/foto-pantalla.mjs; docs/soluciones-decompilacion.md §2.2 y §8.2

#### W4. Piloto de PGO: compilar guiado por un perfil del programa nativo

*Urgente · PC y celular · Un jugador y sala · 3–5 días · Dato de la plataforma · Recompilar el .wasm · Medir primero*

- **Qué pasa:** KartPad (el mismo traductor, nativo en Android) compiló guiado por un perfil (PGO) y ganó **−12 %** de CPU del hilo en una pista que el perfil no había visto y **−13 % de código** (`docs/kartpad.md` §3). Para nosotros vale sobre todo lo segundo: todo lo que agrandó el código perdió en la gama baja (§184, §193), y PGO lo achica. Ojo: con el perfil de una sola carrera, a ellos el código les creció un 9 %.
- **Arreglo:** El programa de Windows (`compilar-nativo.py`) con `-fprofile-instr-generate`, 3 carreras distintas (pistas de Nintendo y de RR), y el `.wasm` compilado con ese perfil (`-fprofile-instr-use`) más `-mllvm -hot-cold-split` (los bloques fríos fuera de las funciones calientes). Las sugerencias de salto de wasm, si LLVM ya las escribe. El perfil lleva nombres de funciones del juego: nunca a git.
- **Gana:** KartPad ×1,14 en nativo; para nosotros ×1,05–1,10 estimado, más en la gama baja; decide si M6 entra completo en la etapa 2
- **Se comprueba:** **Éxito:** **5 % o más** menos CPU por cuadro en la gama baja simulada (tramo fijo, intercalado) en una pista que el perfil no vio, y el `.wasm` no más grande.

**Se mata** si gana **menos de 2 %** en la gama baja o si el código crece. Siempre la sala 75/75 y los fantasmas iguales (con `-ffp-contract=off` el resultado es el mismo por construcción).
- **Dónde:** herramientas/compilar-nativo.py, compilar-web.py (MKW_CFLAGS_EXTRA); docs/kartpad.md §3 y §5; docs/soluciones-motor.md punto 5

#### W5. La simulación del teléfono paga la revisión de límites de Android

*Urgente · Celular · Un jugador y sala · 2–3 días · Medido · Medir primero*

- **Qué pasa:** Chrome en Android no tiene páginas de guarda para wasm: revisa los límites de la memoria en **cada** acceso (está en el código de V8, a propósito). En este PC eso no se paga, así que la gama media y la baja simuladas salen optimistas: forzar esa revisión aquí costó **+16 %** (§160; `docs/soluciones-motor.md` §1). Es como medir una fuente sin la resistencia del cable que va a tener instalada.
- **Arreglo:** Toda medida de un teléfono simulado va con `--js-flags=--wasm-enforce-bounds-checks`: en Chrome (`medir-sitio --chrome "…"`) y en Node (`medir-node-estable --v8 "…"`), dentro de las escaleras y de las tandas. Volver a medir con la bandera la escalera simulada (N2). Es solo para medir: una página no puede poner banderas de V8.
- **Gana:** medir los teléfonos como son de verdad, y poder medir lo que ataca ese costo (W13)
- **Se comprueba:** **Éxito:** la escalera de los escalones de teléfono medida con y sin la bandera, 3 corridas por escalón dentro de ±3 %, y la diferencia anotada (se esperan +10–20 %).

**Si sale menos de 5 %**, se anota y la bandera queda solo como control. Desde aquí, cada medida de un teléfono simulado la lleva.
- **Dónde:** herramientas/medir-sitio.mjs (--chrome), medir-node-estable.mjs (--v8); bitácora §160

#### W6. Dos medidas del programa nativo en la carrera: dar vuelta los bytes y la memoria revisada

*Urgente · PC · Un jugador y sala · 2–3 días · Sospecha · Medir primero · Recompilar el .wasm*

- **Qué pasa:** Antes de meterle 6–9 semanas a la memoria de la Wii (H6, H7) hay que saber cuánto pesa de verdad en la carrera. Dar vuelta los bytes sin la instrucción del procesador se estima en 15–25 % del impuesto y la tabla de páginas en 10–17 % (`docs/soluciones-motor.md` §1), pero el nativo «revisado» solo se midió en el título (§160).
- **Arreglo:** (1) `compilar-nativo.py --bytes-lentos`: el nativo da vuelta los bytes con desplazamientos, como wasm, con una barrera vacía para que clang no los junte otra vez en una sola instrucción. La diferencia en el tramo fijo de la carrera es el costo exacto de dar vuelta los bytes (como `--sin-vector` en §165).

(2) El nativo `--revisado` en la carrera (el guion de §165): el costo de la tabla de páginas.

Las dos con `medir-node-estable --alternar` y el candado.
- **Gana:** el orden de la etapa 2 con números: si (1) + (2) suman menos del 15 % del nativo, H6 y H7 bajan de lugar; si suman 30 % o más, van primero sin discusión
- **Se comprueba:** **Éxito:** las dos razones medidas en 5 pares intercalados, ±2 %.

**Se corta** la parte cara de H7 (guardar la RAM dada vuelta, 4–6 semanas) si dar vuelta los bytes pesa menos del 5 % del nativo.
- **Dónde:** herramientas/compilar-nativo.py (--sin-vector, --revisado), medir-node-estable.mjs; build/web/datos/impuesto-perfil/guion-165.txt; docs/soluciones-motor.md §4.0

#### W7. Las escrituras parciales de las matrices XF

*Media · PC y celular · Un jugador y sala · 1–2 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** KartPad adaptó un arreglo de la aurora de WiiCompiled (`998c456`): una carga de matriz que empieza a mitad de una matriz o cruza dos. Nuestra `copy_xf_data` la rechaza («sub-copy unsupported») y se salta esa carga: si Mario Kart la usa, algo se dibuja mal (`docs/kartpad.md` §4).
- **Arreglo:** Primero buscar el aviso en el registro de una carrera, en varias pistas (también de RR). Si nunca sale, se anota y no se toca. Si sale, el arreglo chico en `command_processor.cpp`, con atribución (GPL-3.0: autor, enlace y commit en el parche y en `herramientas/versiones.md`).
- **Gana:** la imagen correcta donde hoy podría faltar una matriz
- **Se comprueba:** el aviso contado en 5 pistas; si se arregla, la foto antes y después y `prueba-navegador` en verde.
- **Dónde:** aurora lib/gx/command_processor.cpp (copy_xf_data, ~línea 302); parches/aurora-n15a.diff

#### W8. Los pipelines que no se sueltan en una copa entera

*Alta · PC y celular · Un jugador y sala · 2–3 días · Sospecha · Medir primero*

- **Qué pasa:** En KartPad los pipelines compilados nunca se sueltan: +233 MB al pasar por varias pistas, y un Galaxy S10 Lite llegó a 2 GB y bajó a 42 fps tras una hora (`docs/kartpad.md` §3). Nuestra aurora es de la misma familia, y una copa de la sala (o una hora de juego) es justo ese caso. Con dos copias del juego en la etapa 1 (W10) la memoria importa todavía más.
- **Arreglo:** Medir con `medir-memoria.mjs` la memoria de la pestaña y del proceso de GPU tras 4–8 pistas distintas. Si crece sin techo: soltar los pipelines de una pista al dejarla (con la etiqueta por pista de C2, que ya existe), con un tope por memoria.
- **Gana:** que una copa entera y una hora de sala no crezcan en memoria (en un teléfono de 4 GB, que no se cierre la pestaña)
- **Se comprueba:** la memoria tras 8 pistas distintas a menos de +50 MB de la que hay tras 1 (o lo que crezca, explicado); `prueba-sala` en verde.
- **Dónde:** herramientas/medir-memoria.mjs; aurora (caché de pipelines); web/navegador/lista-pipelines.mjs

#### W9. Personajes invisibles en tarjetas Adreno 6xx/7xx: el chequeo

*Media · Celular · Un jugador y sala · 2–3 días · Dato de la plataforma*

- **Qué pasa:** En KartPad los personajes salen invisibles en tarjetas Adreno 6xx/7xx (muy comunes en la gama media: Galaxy S24, Moto G85, OnePlus), por el controlador de Vulkan con las matrices de los huesos. Chrome en Android también dibuja con Vulkan (por Dawn), así que nos puede pasar. El Oppo es Mali: no lo habríamos visto. Sin un teléfono Adreno no se puede probar (la regla del dueño: solo este PC).
- **Arreglo:** (1) El informe de rendimiento y el registro anotan la tarjeta (`GPUAdapterInfo`: fabricante y arquitectura) y avisan si es Adreno 6xx/7xx.

(2) Un camino de reserva preparado y apagado: las matrices de los huesos en un búfer de uniformes, como lo esquiva KartPad, probado en este PC con la misma foto.

(3) Se prende para Adreno recién cuando llegue el primer informe de un jugador.
- **Gana:** no enterarse por un jugador sin tener nada listo
- **Se comprueba:** banco con un adaptador de mentira «Adreno 730»: el aviso sale; con el camino de reserva prendido, la foto en este PC igual (menos del 0,5 % de los píxeles con más de 2 niveles).
- **Dónde:** web/navegador/perfil-gpu.mjs, mkw.mjs (mkwInformeRendimiento); aurora gx/shader.cpp; docs/kartpad.md §4

#### W19. El índice del memo de las llamadas indirectas (el arreglo `20ad85d` de KartPad)

*Alta · PC y celular · Un jugador y sala · 1 día · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** El memo que recuerda adónde fue cada llamada indirecta elige su casillero con los bits bajos del hash de Fibonacci, que son los que peor se reparten: muchas llamadas caen en el mismo casillero y se pisan (`runtime/include/guest_abi/dispatch.h`, líneas ~339 y ~359). Lo encontró DriftDroid y KartPad lo arregló en una línea (`20ad85d`, GPL-3.0). Nosotros todavía lo tenemos (`docs/kartpad.md`).
- **Arreglo:** Tomar los bits altos del hash, como en `20ad85d`, con atribución en el parche y en `herramientas/versiones.md`.
- **Gana:** menos fallos del memo (estimado: poco, pero gratis); es un arreglo, no un experimento
- **Se comprueba:** `paridad` 28/0, huellas 75/75 con `--build-b`, `prueba-fantasma-igual`; el tramo fijo en la gama baja simulada y en este PC, intercalados.
- **Dónde:** terceros/Wiicompiled-motor/runtime/include/guest_abi/dispatch.h; chrissotraidis/wiicompiled 20ad85d; docs/kartpad.md

#### W20. Soltar las texturas de copia que nadie usa (la mitad de `0cca4d2` de KartPad)

*Media · PC y celular · Un jugador y sala · 1–2 días · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** La aurora guarda una piscina de texturas para las copias del cuadro (EFB) y nunca suelta las que dejaron de usarse: la memoria de la tarjeta crece con las pistas. KartPad suelta las ociosas (`0cca4d2`, la parte de la piscina). Va junto con W8.
- **Arreglo:** Portar solo la parte de la piscina de `0cca4d2` (soltar lo que lleva N cuadros sin usarse), con atribución.
- **Gana:** menos memoria de tarjeta en una copa entera (importa en teléfonos de 4 GB y con las dos copias de W10)
- **Se comprueba:** con `medir-memoria.mjs`, 8 pistas distintas: la memoria del proceso de GPU sin crecer de más; la foto igual; `prueba-navegador` en verde.
- **Dónde:** aurora gfx (piscina de copias); chrissotraidis/wiicompiled 0cca4d2; docs/kartpad.md

#### W10. A1-s: el dibujo y la presentación en un segundo Worker, sin memoria compartida

*Urgente · PC y celular · Un jugador y sala · 4–6 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Hoy un solo hilo calcula la carrera, arma el dibujo y lo presenta, en serie: el cuadro dura la suma (11,1 ms en este PC: la carrera ~4,2, el dibujo del juego con aurora ~2,8, presentar ~0,95 y el resto ~3,2; reagrupado del perfil de §160). Como el dibujo es un sumidero (R2, W1), puede ir entero a otro núcleo, un cuadro atrás, sin cambiar la carrera. Es pasar de dos resistencias en serie a dos ramas en paralelo: manda la más cargada. Dolphin no puede hacerlo (imita un solo procesador y no sabe qué parte del programa dibuja); nosotros tenemos el programa traducido función por función.
- **Arreglo:** Dos copias del mismo programa en dos Workers: **A** corre la carrera; **B** solo dibuja y presenta (es dueña de WebGPU y del lienzo, `OffscreenCanvas`). Al final de cada cuadro, A junta sus páginas sucias (W1) en una caja y la transfiere por la cinta de cajas (§188); B la pega en su memoria y llama a la misma función de dibujo que hoy llama el bucle del juego. En A esa llamada se cambia por «mandar la caja» más la parte chica que la carrera lee (la de R2).

En la caja viaja también lo que no es memoria de la Wii y el dibujo usa (los avisos de texturas cambiadas, la hora de la carrera). Anda en cualquier Chrome, también en Android de hoy, sin Document-Isolation-Policy. Va sobre el arnés del Worker de §186 (N3, P10). Con memoria compartida, más adelante, B puede ser un hilo del mismo programa y no copiar lo que nadie ensucia (si H5 lo permite).

Dos lecciones de KartPad (`docs/kartpad.md`): el trabajo pasa a B **de a un cuadro entero, nunca de a una primitiva** (DriftDroid cayó a ~20 fps mandando de a una); y A y B tienen que poder caer en núcleos distintos (su beta con los tres hilos en un núcleo dio 19–22 fps, sueltos 48–60). En el teléfono, un hilo que espera puede hacer que el sistema baje la velocidad del procesador: medirlo con el informe.
- **Gana:** el hilo de la carrera 11,1 → ~6,2 ms en este PC (×1,5–1,9, estimado); contiene a los pasos 8 y 9 viejos y va más lejos que el «dual core» de Dolphin
- **Se comprueba:** la sala con un programa A1 y uno de hoy (`--build-b`): huellas 75/75; `prueba-fantasma-igual` cuadro por cuadro; la foto del cuadro N con A1 igual a la del cuadro N de hoy; el tramo fijo en la gama baja simulada (con W5) y en este PC, intercalados; la memoria de la segunda copia (+250–400 MB estimado) con `medir-memoria.mjs`.
- **Dónde:** web/navegador/trabajador-dom.mjs, cajas.mjs (§186–§188); web/juego/lockstep_nativo.cpp (ScnMgr::DrawMain); docs/soluciones-arquitectura.md §1 y §7

#### W11. A2: lo que solo se ve de la parte de calcular, también al Worker del dibujo

*Alta · PC y celular · Un jugador y sala · 3–4 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Con W10, en el hilo de la carrera quedan cosas que no deciden la carrera: calcular los efectos (~0,35 ms), decidir qué suena (~0,21), actualizar la interfaz 2D (~0,16) y el hilo de sonido del juego (~0,57) (reagrupado del perfil de §160).
- **Arreglo:** Primero las pruebas de «saltar», como R2: saltar cada sistema por vez y mirar las huellas y el fantasma (días). Lo que pase la prueba se mueve a B (el sonido, al AudioWorklet o a otro Worker). Lo que use el azar de la carrera, o mande en ella (la pausa), se queda en A. Reemplaza a H10.
- **Gana:** −0,6 a −1,3 ms en el hilo de la carrera de este PC (estimado)
- **Se comprueba:** por cada sistema, la prueba de saltar (huellas 75/75, el fantasma igual); después, las mismas pruebas que W10.
- **Dónde:** docs/soluciones-arquitectura.md §7 (A2); web/navegador/sonido-worklet.js

#### W12. La pila de la Wii en variables locales

*Alta · PC y celular · Un jugador y sala · 3–4 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** En el código traducido ~23 % de los accesos directos a la memoria y ~35 % de los rangos son relativos a r1, la pila de la Wii (contado en 40 de los 202 archivos): guardar y reponer r14–r31 y LR, y variables temporales. Cada uno paga hoy la tabla de páginas, dar vuelta los bytes y, en Android, la revisión de límites (W5).
- **Arreglo:** Si el traductor demuestra que una función nunca pasa la dirección de su pila a otra (ningún `addi rX, r1, k` que escape), sus casilleros de la pila pasan a ser variables de C++ y el acceso desaparece entero, no solo se abarata. Quedan afuera las funciones con ganchos o continuaciones de RR (reponen r14–r31 de la pila de otra función, §178) y la cadena de marcos (0(r1)). Usa la maquinaria del modo seguro de M8 y del vigía.
- **Gana:** el código traducido ×1,06–1,15 encima de H6 (estimado); gana también contra el nativo, porque es trabajo de la traducción y no impuesto
- **Se comprueba:** el vigía en modo «guardar igual y comparar al leer» (avisa si alguien lee desde afuera un casillero promovido); huellas 75/75; fantasmas iguales; el volcado de la RAM sin los casilleros muertos de la pila.
- **Dónde:** docs/soluciones-motor.md punto 2; parches/traductor-m8.diff; MKW_VIGIA

#### W13. El contexto de la CPU en una dirección fija

*Alta · Celular · Un jugador y sala · 1–2 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Los registros que se guardan (`ctx->gpr[n]`) son ~12 mil escrituras y ~12 mil lecturas por cada 90 mil líneas traducidas, a través de un puntero que se pasa a cada función. En Android cada uno paga la revisión de límites (W5).
- **Arreglo:** La Wii tiene un solo procesador: un solo contexto global en una dirección constante de la memoria de wasm; al cambiar de hilo del juego (7–8 veces por cuadro, §152) se copia (~1 KB). Con la dirección constante, V8 puede saltarse la revisión de esos accesos (a verificar en V8) y queda libre un registro.
- **Gana:** este PC ×1,00–1,03; Android ×1,05–1,10 (estimado), medido con la bandera de W5
- **Se comprueba:** `paridad`, `prueba-arranque` y las huellas; el tramo fijo con y sin `--wasm-enforce-bounds-checks`.
- **Dónde:** docs/soluciones-motor.md punto 3; runtime (ctx, fibras, HLE)

#### W14. Las banderas del CR «perezosas», y terminar el modo seguro de §193

*Alta · PC y celular · Un jugador y sala · 2–3 semanas · Medido · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Cada comparación arma hoy 4 bits y los mete en el CR empaquetado de 32 bits, y el CR se guarda entero en cada llamada, así que se calcula siempre. El techo de guardar solo lo que se lee ya está medido en el juego entero: Node ×0,88 (§193). Pero el «techo» separaba la sala en el cuadro 270, porque RR no cumple la regla de la Wii; el «seguro» quedó a medias (§193.1: falta saber qué funciones pueden ser destino de una llamada indirecta).
- **Arreglo:** Como Dolphin: cada campo del CR es una variable aparte con el resultado de la comparación; un salto lee el bit con 1 operación; el CR empaquetado se arma solo para `mfcr`, `mtcrf` o al guardarlo; el acarreo (XER.CA), una variable de 1 bit. Encima, los 4 pasos que faltan del modo seguro (la indirecta lee solo la unión de lo que leen sus destinos, la regla justa para el mod, el punto fijo entre las dos pasadas): se guardan solo los campos que alguien lee y clang borra el resto. Lo útil de M8 sigue aquí.
- **Gana:** el código traducido ×1,08–1,15 (estimado), y el código más chico
- **Se comprueba:** la paridad de todas las operaciones del CR con un millón de casos contra la versión de hoy; **siempre** en la sala (huellas 75/75 con `--build-b`) y los fantasmas iguales.
- **Dónde:** docs/soluciones-motor.md punto 4; bitácora §193 y §193.1; terceros/Wiicompiled-motor-seguro

#### W15. D-a: el envío del dibujo en nativo (el renderizador WebGPU propio, primer nivel)

*Alta · PC y celular · Un jugador y sala · 6–10 semanas · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Solo si W3 pasó. Hoy, en cada imagen, el juego recorre la escena, calcula animaciones y matrices y manda órdenes GX que aurora convierte una por una a WebGPU (estados, formatos, recetas, subidas).
- **Arreglo:** Al cargar cada modelo (pista, karts, personajes, objetos): sus vértices en búferes de la tarjeta y sus materiales TEV ya convertidos en recetas. En cada imagen: las matrices de todos en un solo búfer (leídas de la memoria del juego, que sigue haciendo las animaciones y el árbol de escena), lo repetido (cajas de objetos, monedas, árboles, público) instanciado, y lo fijo de la pista en un render bundle. Corre en el Worker del dibujo (W10).

Tiene que seguir escribiendo las marcas de «se ve» que la lógica lee en la sala (G1). Es código derivado del de Nintendo: carpeta ignorada, nunca a git, solo dentro del `.wasm` privado de R2. Reemplaza a G7 y H13.
- **Gana:** −1,5 a −2,5 ms de CPU por imagen en este PC (estimado, en el hilo del dibujo); probablemente también menos trabajo para la tarjeta (sin medir)
- **Se comprueba:** la foto de cada pista igual (menos del 0,5 % de los píxeles con más de 2 niveles), en 10 pistas, también de RR; huellas 75/75 con un programa D-a y uno de hoy (por las marcas de «se ve»); el tramo fijo en la gama baja y en este PC.
- **Dónde:** docs/soluciones-decompilacion.md §2.2 y §6.4; aurora; noclip.website (referencia de formatos, MIT)

#### W16. D-b: el dibujo entero en nativo

*Media · PC y celular · Un jugador y sala · 3–5 meses · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Solo si W15 mostró su ganancia. Con D-a siguen traducidas las animaciones de esqueleto y de materiales, el 2D (el marcador), los efectos de imagen (brillo, profundidad) y las copias del EFB.
- **Arreglo:** Todo eso en C++ propio, en el Worker del dibujo, entendido con lo decompilado y nunca copiado. El 2D de RR está muy parcheado: se rehace con sus cambios. Lo que la lógica lea (si W1 encuentra algo, como huesos que chocan) se queda en la carrera. Con todos los efectos: ninguno se saca. Las partículas (`nw4r::ef`) van aquí también, si el vigía muestra que no usan el azar de la carrera (lo que era W18, que la poda juntó con este). Reemplaza a N6.
- **Gana:** el dibujo 6,7 → 2–3 ms de CPU por imagen en este PC (estimado)
- **Se comprueba:** fotos iguales en 10 pistas y en el 2D (el marcador, el mapa, los menús de la carrera); huellas 75/75; fantasmas iguales; el tramo fijo.
- **Dónde:** docs/soluciones-decompilacion.md §2.2 y §6.4

#### W17. Las islas de la lógica: la colisión y la física del kart

*Alta · PC y celular · Un jugador y sala · 3–5 meses · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Solo si W2 pasó (×2,0 o más). La física del kart es ~25–35 % de la lógica (estimado), con un borde ancho (12 karts que leen la IA, los objetos, la cámara y el marcador) y mucha multiplicación-suma, y tiene que dar los mismos bits que la Wii: los fantasmas expertos de RR se grabaron en una Wii de verdad.
- **Arreglo:** Por fases (`docs/soluciones-decompilacion.md` §5.2): el inventario de qué datos toca cada función y quién más los toca; la fuente con tipos sobre la memoria de la Wii, comprobada con el comprobador de N14; recién después, los datos de la isla a memoria propia en orden nativo, con el borde convertido una vez por cuadro.

La colisión del piloto entra primero; después, la física. El traducido queda de «testigo» semanas (correr los dos en las pruebas y comparar), en muchas pistas, con todos los objetos y los niveles de CPU. Reemplaza a N7. La IA de la CPU y los objetos, solo si esto rinde y el dueño lo pide.
- **Gana:** la lógica ×2–2,5 en lo decompilado (realista, estimado); es lo que acerca la gama baja a 60 cuadros de carrera
- **Se comprueba:** 0 diferencias en el comprobador del borde; `prueba-fantasma-igual` contra el experto; un juego de fantasmas grabados en una Wii de verdad; la sala 75/75; `correr-todo`.
- **Dónde:** docs/soluciones-decompilacion.md §3, §5 y §6; web/juego/caliente_nativo.cpp

#### W18. Los efectos (partículas) en nativo

*Media · PC y celular · Un jugador y sala · 4–6 semanas · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Los efectos se calculan dentro de la carrera (~0,35 ms en este PC) y se dibujan con el resto (`nw4r::ef`). Si no usan el azar de la carrera, son solo dibujo.
- **Arreglo:** Primero mirar con el vigía si usan el azar del juego: si lo usan, son lógica y se quedan donde están. Si no, en C++ propio, en el Worker del dibujo, con todos los efectos (ninguno se saca). Va junto con W16 y después de la prueba de saltar de W11.
- **Gana:** parte del −3,5 a −4,5 ms de D-b; sin medir aparte
- **Se comprueba:** fotos iguales a simple vista en las escenas con más efectos; huellas 75/75; fantasmas iguales.
- **Dónde:** generated/guest_symbol_table.cpp (nw4r::ef); MKW_VIGIA; docs/soluciones-decompilacion.md §5.3

#### W21. Hilos de verdad: el sitio aislado con un service worker (COOP/COEP)

*Alta · PC y celular · Un jugador y sala · 1–2 semanas (estimado) · Sospecha · Medir primero · Lo hace el dueño*

- **Qué pasa:** El sitio está en GitHub Pages, que no puede mandar las cabeceras COOP/COEP. Sin ellas no hay memoria compartida (`SharedArrayBuffer`): cada núcleo trabaja solo y los datos hay que copiarlos por mensaje. Por eso se atascó la parte B de W10 y por eso se descartaron aurora y el sonido en hilos propios.
- **Arreglo:** Un service worker que agrega esas cabeceras a cada respuesta dentro del navegador (técnica conocida; `credentialless` donde ayude). Con memoria compartida, el dibujo en otro núcleo (W10) va sin copias, y aurora y el sonido pueden tener hilo propio. Comparación: pasar de mandar cartas entre dos oficinas a trabajar en la misma mesa.

Día 1: ponerlo en el sitio local (`herramientas/sitio-local.mjs`) y comprobar que siguen andando el ingreso con Firebase, los marcos (iframes) y el Worker de R2 (CORS). Riesgo: romper el sitio bajo aislamiento. Llega al sitio real solo por un PR en Paginita-Pro, que el dueño confirma antes (cada vez).
- **Gana:** abre la puerta a W10 sin copias y a aurora y el sonido en hilos propios; no gana cuadros por sí solo (estimado, sin medir)
- **Se comprueba:** el sitio local entero con aislamiento (login, marcos, Worker) y `crossOriginIsolated` en verdadero dentro del marco del juego; después, lo que se construya encima con su propia prueba.
- **Dónde:** bitácora §222; herramientas/sitio-local.mjs; terceros/Paginita-Pro

#### W22. El dibujo retenido: aurora rehecha para la web

*Alta · PC y celular · Un jugador y sala · 4–8 semanas (estimado) · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Del dibujo de la gama baja (~10 ms de ~20 por cuadro), esconder todos los modelos ahorra solo 0,6–0,7 ms (bitácora §222): ~9 ms son el esqueleto fijo de cada imagen (el 2D, las copias de imagen, el posproceso y el trabajo base de aurora). Sospecha: miles de órdenes por cuadro que cruzan wasm → JavaScript → Chrome, cada una con su costo, como muchos conectores en un circuito, cada uno con su pequeña caída de tensión.
- **Arreglo:** Que aurora detecte que el cuadro se parece al anterior y repita lo que ya grabó (render bundles de WebGPU), con menos órdenes (menos cambios de recursos, desplazamientos dinámicos en un solo búfer), en vez de armar todo otra vez. Día 1 (horas): medir el esqueleto por partes con los contadores que ya hay (`MKW_CONTADORES`; `perfil-gpu.mjs` cuenta pasadas y dibujos por cuadro) para confirmar la sospecha antes de construir.
- **Gana:** hasta una parte de los ~9 ms del esqueleto (estimado, sin medir; si la sospecha no se confirma, nada)
- **Se comprueba:** el esqueleto medido por partes; si se construye, el costo del dibujo por cuadro más bajo en la gama baja simulada (tramo fijo §163, con `--wasm-enforce-bounds-checks`) y la foto igual.
- **Dónde:** bitácora §222; web/navegador/perfil-gpu.mjs; mkw_contadores.h; aurora

#### W23. Los saltos indirectos en línea: `call_ref` y la inline especulativa de V8

*Media · PC y celular · Un jugador y sala · 2–4 semanas (estimado) · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** El código traducido salta mucho por punteros a función. Cada llamada indirecta cuesta cerca del doble que una directa (medido en la prueba chica: 13 → 26 ns, `herramientas/micro-indirectas/`).
- **Arreglo:** El Chrome reciente puede adivinar el destino y ponerlo en línea, pero solo con `call_ref`, no con `call_indirect`. Cambiar cómo el traductor escribe esos saltos. Día 1: la prueba chica de hoy escrita de las dos formas, en Chrome. Tiene que dar la misma carrera (huellas y fantasmas).
- **Gana:** parte del costo de las llamadas indirectas del código traducido (estimado, sin medir)
- **Se comprueba:** la prueba chica primero y después el juego, con huellas 75/75 y el fantasma igual; medido en la gama baja simulada y en este PC.
- **Dónde:** herramientas/micro-indirectas/; bitácora §193 (las indirectas); parches/motor-w19.diff

#### W24. OPCIONAL: el teléfono solo dibuja y el PC de la sala calcula por él

*Investigar · Celular · Sala · 3–6 semanas (estimado) · Sospecha · Medir primero*

- **Qué pasa:** Opcional (el dueño, 2026-11-04). En la sala, un teléfono de gama baja no alcanza a simular 60.
- **Arreglo:** En lugar del video (N11), el PC manda al teléfono la memoria que cambió en cada cuadro (la caja que W10 ya arma, 85–99 KB por cuadro) y el teléfono solo dibuja, nítido a su propia resolución. Precio: mucha más subida que el video; hay que medir primero cuánto se comprime. Solo en la sala. Es una alternativa opcional a N11; la etapa no la necesita.
- **Gana:** el teléfono de gama baja en la sala a 60 y nítido (estimado, sin medir; depende de la subida)
- **Se comprueba:** cuánto se comprime la caja por cuadro y cuánta subida pide; si se construye, un teléfono simulado a 60 en la sala con la huella igual.
- **Dónde:** bitácora §207 (la caja de diferencias de W10); docs de N11

#### W25. Las mejoras chicas, juntas: un paquete medido de una vez y PGO como sello

*Media · PC y celular · Un jugador y sala · 1–2 semanas (estimado) · Medido · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Varias mejoras dieron +1 a +6 % y se descartaron porque el ruido de la medición en la gama baja es del mismo tamaño (±5 %): sola, ninguna se distingue de cero. El dueño (2026-11-05): «si acumulas eso, ¿no sería un 30 % con 10 de esos?». Se multiplican (1,03¹⁰ = 1,34), pero hay que saber cuáles son reales.

Las candidatas, todas exactas (la misma carrera): C1 PGO (gama baja +2,2 %, este PC +3,2 %, `.wasm` −8,3 %; §198), C2 texturas BC1 en los PC (gama baja ≈ +6 %; §190.2), C3 tres funciones calientes a mano (Node ×1,010; §181.2), C4 el memo ×4 (Node ×0,993; §193), C5 no releer r14–r31 (lecturas −47 %; §178), C6 el CR seguro (Node ×0,9928; §217) y C7 `wasm-opt -O3` (`.wasm` −2,4 %; §54). Las que perdieron en la gama baja (hojas, FMA, VUELTA32, H11, N3) no entran.
- **Arreglo:** Medirlas juntas: una suma de +8 % sí sobresale del ruido, como una señal chica que aparece al promediar muchos barridos del osciloscopio. Paso 0: pasar cada una a la base que deje E4b, con su interruptor de compilación y su arranque y fantasma iguales. Paso 1: el paquete C2–C7 con la igualdad entera. Paso 2: el paquete contra la base en la gama baja simulada (tramo fijo §163, `--wasm-enforce-bounds-checks`, N8 apagado) y este PC; 2 pares deciden si ≥ +8 % o ≤ −2 %, hasta 6 en la zona gris, y como todas son exactas se adopta con la media de 6 pares positiva (intervalo del 95 % sobre cero) y este PC sin perder más de 1,5 %.

Paso 3 (opcional): sacar de a una solo las que tienen costo propio (C2 cambia píxeles, C5 toca el traductor). Paso 4: PGO encima, como sello, con el perfil rehecho solo en cada `--final` desde el guion de §165 (así deja de atarse a mano a cada cambio). El detalle en `docs/evaluacion-chicas.md`. W8 modo 2 (la memoria de la tarjeta) va aparte, en el teléfono y la sala.
- **Gana:** +3 a +8 % en la gama baja (estimado; la suma de lo medido daría +8 a +12 % si todo fuera real y no se pisara); seguro, el `.wasm` 8–10 % más chico
- **Se comprueba:** arranque 13/13, sala 75/75 con los dos programas, fantasma y foto iguales (la foto con C2 apagado; C2 con `?texturasBc=verifica`); el paquete medido contra la base en la gama baja simulada y en este PC.
- **Dónde:** docs/evaluacion-chicas.md; bitácora §54, §178, §181.2, §190.2, §193, §198, §213, §217

### V · Medir primero

Varias causas son sospechas fuertes pero sin número. Medir primero evita gastar días en lo que no pesa. Ninguna de estas mediciones cambia el juego: son contadores y guiones, como poner un osciloscopio antes de cambiar componentes.

#### V1. En el teléfono: separar el juego, la espera y la tarjeta de video

*Urgente · Celular · Un jugador y sala · 1–2 días · Medido · Medir primero · Lo hace el dueño*

- **Qué pasa:** En el Oppo Find X9 Pro el informe dio «juego» 33,4 ms y «tarjeta» 33,8 ms por cuadro, pero cada número contiene al otro: el del juego incluye la pausa de presentar y el de la tarjeta incluye la cola. Por eso no se sabe si frena la CPU o la GPU. Además «tarjeta» mide latencia, no trabajo: una 3080 Ti marca 4,4–6,3 ms.
- **Arreglo:** El plan de §115.5: el cálculo puro (juego menos las esperas), `perfil-gpu.mjs` por pasada con timestamp-query (ya arreglado según G8) y una traza Perfetto del proceso de GPU del teléfono. Este número decide entre los caminos de «¿Asíncrono?» y ordena las fases 4 y 5.
- **Gana:** saber qué optimizar en el teléfono en vez de adivinar
- **Se comprueba:** el informe de rendimiento con los tres números separados, en 1.ª y 2.ª visita.
- **Dónde:** web/navegador/perfil-gpu.mjs; bitácora §115

#### V2. Medir el arranque como lo sufre un amigo (tareas largas, CPU y memoria por proceso)

*Urgente · PC y celular · Un jugador y sala · 1–2 días · Medido · Medir primero*

- **Qué pasa:** No hay ningún registro de las tareas largas del arranque: `medir-sitio` mide «hilo ocupado» solo durante la carrera. El freno de CPU de las pruebas (`setCPUThrottlingRate`) solo frena al proceso de la página, no al de GPU, así que el «PC débil» del lado de la GPU nunca se midió. La memoria por proceso tampoco. Y Playwright no ve el menú de inicio, así que siempre mide el precalentado sin tope.
- **Arreglo:** Sumar a `medir-sitio` un modo de arranque: tareas largas desde la navegación, CPU y memoria de cada proceso de Chrome cada segundo (CDP `SystemInfo.getProcessInfo`), una 2.ª pestaña con un latido (lo que se atrasa = cuánto se trabó el navegador entero) y Chrome atado a 2–4 núcleos con un perfil nuevo (un PC de amigo de verdad).
- **Gana:** la línea base de C1 a C9: sin ella no se puede decir «ya no se traba»
- **Se comprueba:** un informe `medir-sitio --arranque` con esos números, guardado en `build/web/datos/`.
- **Dónde:** herramientas/medir-sitio.mjs:102,154,219-220

#### V3. Medir una carrera completa, de la cuenta a la meta

*Urgente · PC y celular · Un jugador y sala · 1 día · Medido · Medir primero*

- **Qué pasa:** `medir-sitio` corta a los 15–20 s de carrera y las pruebas terminan con EndLap. Nadie midió lo que se lee en la última vuelta y en la meta: `STRM_N_*_F` y la música de la última vuelta, `55_Final` y `58_Final` de RR, `o_FanfareGP1_32` (6,1 MB) y la fanfarria de meta.
- **Arreglo:** Un guion que corra las 3 vueltas enteras (o con la CPU manejando al humano) con `?trazaDisco=1` y un perfil nuevo, y que anote lecturas, MB y esperas al disco durante la carrera.
- **Gana:** el manifiesto completo del paquete de carrera (D1)
- **Se comprueba:** `mkwLecturas()` de la carrera entera, de 3 pistas distintas.
- **Dónde:** herramientas/medir-sitio.mjs; web/navegador/fotos-pistas.mjs

#### V4. Contadores por cuadro dentro del motor

*Alta · PC y celular · Un jugador y sala · 1–2 días · Leído en el código · Medir primero · Recompilar el .wasm*

- **Qué pasa:** No se sabe cuántas caídas al camino lento de memoria, escrituras, FMA, llamadas indirectas, cambios de fibra y suspensiones JSPI hay por cuadro. El perfil con CPU ×4 deja un 18 % de muestras sin atribuir y reparte el ~60 % en miles de funciones.
- **Arreglo:** Contadores baratos compilados solo con una bandera (como `MKW_DEPURAR*`) que el medidor muestra por segundo, y un perfil del juego corriendo en Node (`web/node/correr.mjs`).
- **Gana:** ordenar M1 a M10 por lo que de verdad pesa
- **Se comprueba:** el medidor con `?contadores=1` en un jugador y en la sala.
- **Dónde:** herramientas/compilar-web.py:303-424 (banderas MKW_DEPURAR)

#### V5. Contar los cuadros de lógica, no solo los dibujados

*Urgente · PC y celular · Un jugador y sala · horas · Leído en el código · Recompilar el .wasm*

- **Qué pasa:** Fuera de la sala, RR deja de dibujar cuadros cuando va atrasado (`rr_kamek_81806568`), y el fps de la página cuenta dibujos (`g_mkwCuadros`). Así, «30 fps» en un jugador puede ser la lógica a 60 dibujando uno de cada dos cuadros, o la lógica de verdad a 30. Sin un contador de lógica no se sabe qué arreglar.
- **Arreglo:** Un contador de cuadros de lógica (al pasar por `RaceScene::OnCalc` o por el VI) junto a `g_mkwCuadros`, en el medidor y en el informe de rendimiento del teléfono.
- **Gana:** saber si un jugador frena por la CPU o por el dibujo
- **Se comprueba:** el medidor muestra «lógica N / dibujo M» por segundo.
- **Dónde:** web/navegador/puente.cpp (g_mkwCuadros)

#### V6. Sesiones largas: 1 hora de sala y una copa entera en el teléfono

*Alta · PC y celular · Un jugador y sala · 1 día · Sospecha · Medir primero*

- **Qué pasa:** Varias cosas crecen sin tope: las tablas del lockstep (se vacían solo al empezar otra carrera), el registro de la página y la lista propia de pipelines. Nadie midió la memoria ni las limpiezas de basura después de una hora, ni si el teléfono se calienta y baja su reloj en una copa entera.
- **Arreglo:** Correr `prueba-sincro --copa` y una hora de sala anotando la memoria, las limpiezas de basura y la CPU por cuadro de cada minuto.
- **Gana:** atrapar fugas y calentamientos antes que los amigos
- **Se comprueba:** memoria plana y CPU por cuadro estable después de 1 h.
- **Dónde:** web/navegador/prueba-sincro.mjs

#### V7. Una sala de 12 con lo que hay: varios Chrome y consolas de mentira

*Alta · PC y celular · Sala · 3–5 días · Sospecha · Medir primero*

- **Qué pasa:** `prueba-doce` son 12 pestañas en un mismo PC: no prueba la red de verdad (66 enlaces WebRTC, la subida de cada casa, el repetidor) ni aparatos distintos.
- **Arreglo:** No hay más aparato que este PC (el Oppo ya no se mide, el dueño, 2026-10-31), así que la sala más grande se arma así: 3–4 Chrome con el juego en el PC (un perfil cada uno), uno de ellos como teléfono (emulación, CPU frenada y el lastre de gama media, H1), y el resto de los 12 humanos con **consolas de mentira** del banco: no corren el juego, solo mandan botones grabados al ritmo del lockstep, con la red mala de mentira (`?redMala`) de una casa cualquiera; no comparan la huella. Cada consola de verdad corre `medir-enlinea.mjs`: esperas, retraso, relevos, cuadros y refrescos.
- **Gana:** el número final de «perfecto y fluido» con lo que hay
- **Se comprueba:** las consolas de verdad a 60 cuadros por segundo y ninguna espera de más de 50 ms en 3 carreras, con la huella igual entre ellas.
- **Dónde:** herramientas/medir-enlinea.mjs

### C · La carga y el arranque: lo que congela el PC y todo Chrome

Respuesta al punto 4. La causa principal está en el **proceso de GPU de Chrome**, que es uno solo para todas las pestañas y ventanas: el precalentado le pide 730–930 pipelines en 1–2 s sin tope. Encima se bajan unos 205 MB en el primer minuto sin freno y V8 compila 108 MB de código. Es como arrancar todos los motores de una planta a la vez: la corriente de arranque tumba el tablero entero, no solo la máquina que arrancó.

#### C1. Tope al precalentado de pipelines, siempre

*Urgente · PC y celular · Un jugador y sala · horas · Medido*

- **Qué pasa:** En la 1.ª visita y en toda sala, aurora pide los pipelines de a 8 por cuadro sin tope de «en camino» (`g_webEnCaminoMax=0`). En la sala con dos pestañas: 723 pedidos en 1 s, hasta 553 en camino y una llegada media de hasta 3,7 s; hubo un cuadro de 265 ms. Dawn los compila en hilos del proceso de GPU, que también compone las demás pestañas y la interfaz de Chrome: en un PC de 4 núcleos serían 30 s o más con la CPU al 100 %. El modo «tarde» (2 por cuadro, máximo 4 en camino) ya existe, pero solo se usa en la 2.ª visita de un jugador (`quiereInicio` exige que no haya `?modo`).
- **Arreglo:** Usar el modo con tope por omisión, también en la 1.ª visita y en la sala, con «en camino» como máximo max(2, núcleos/4). Ya existe en C++: es un cambio de la página (`mkw.mjs`), sin recompilar ni subir nada. Ajustar `preparacion.mjs` para que la espera de la sala no dependa de que lleguen todos de golpe. Ojo: cada actualización de Chrome o del driver puede vaciar la caché de pipelines, así que el arranque con tope tiene que ser bueno también sin caché.
- **Gana:** el PC y las demás pestañas dejan de congelarse al abrir el juego; se van los cuadros de 265–854 ms
- **Se comprueba:** CPU del proceso de GPU cada segundo y el latido de una 2.ª pestaña (V2): no se atrasa más de 50 ms. Dibujos saltados por pipeline que falta.
- **Dónde:** web/navegador/mkw.mjs:865-874; parches/aurora-web.diff:343,394,626-628,722-723; web/navegador/preparacion.mjs:26-27

#### C2. Precalentar solo lo que viene, por pantalla y por pista

*Alta · PC y celular · Un jugador y sala · 3–5 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** La lista propia guarda cada pipeline usado (tope 8192) y en cada arranque se vuelve a pedir entera: el arranque se encarece con cada pista jugada. En el teléfono, 931 pipelines a 100–1000 ms cada uno tardaron 41 s y se metieron en la carrera.
- **Arreglo:** Marcar cada pipeline con la pantalla o la pista donde apareció. Al arrancar, solo los de los menús; los de la pista, durante su carga y antes de la cuenta (junto con el paquete de D1). Podar los que no se usan hace varias visitas.
- **Gana:** arranque corto que no crece con las visitas; en el teléfono deja de meterse en la carrera
- **Se comprueba:** pipelines y ms por arranque con historial (`medir-sitio --visitas 3`).
- **Dónde:** parches/aurora-web.diff:396,409-417; web/navegador/pipelines.mjs

#### C3. Ningún pipeline armado de golpe en plena carrera

*Urgente · PC y celular · Un jugador y sala · 2–3 días · Medido · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Las pasadas que no se pueden saltar (las que hornean una textura, como el minimapa) arman su pipeline en el momento y de forma sincrónica (`web_terminar_ya`). Al abrir la carrera 1 de la sala fueron 36 de golpe: un segundo entero a 6,9 fps.
- **Arreglo:** Que esas pasadas esperen unos cuadros al pipeline asíncrono, repitiendo la textura del cuadro anterior, y que la carga de la pista los pida antes (C2).
- **Gana:** se va el tirón de la primera vez en cada pista nueva
- **Se comprueba:** contador «armados en el momento» = 0 en `prueba-sala` con perfil nuevo.
- **Dónde:** parches/aurora-web.diff:456-469; build/web/datos/sala/registro.txt:1237-1239

#### C4. Descargas con freno, con prioridad y en su momento

*Urgente · PC y celular · Un jugador y sala · 1–2 días · Medido*

- **Qué pasa:** No hay tope de velocidad en ninguna capa: 4 lotes de 16 MB en vuelo, 12 + 12 trabajos de fondo y 24 descargas en la precarga. La 1.ª visita pidió 112 MB en los primeros 10 s (unos 90 Mbit/s) y unos 205 MB en el primer minuto. §93.4 ya vio que «todo a la vez» llena 50 Mbit/s y empeora la carga. Con el enlace lleno el WebRTC hace cola y salta el relevo; con dos PCs en la misma casa, lo que baja uno traba la carrera del otro. Ninguna descarga usa `priority`.
- **Arreglo:** Un limitador de cubeta de fichas en `lote.mjs`: el fondo como mucho al 40–50 % del ancho medido y a 0 durante la carrera; lotes de fondo de 2–4 MB; `priority: "high"` para lo que el juego espera y `"low"` para el fondo; nada de fondo hasta llegar al título.
- **Gana:** la conexión de la casa no se satura y el WebRTC no hace cola
- **Se comprueba:** MB por segundo y el latido de la red con `medir-sitio --red 50`; banco `lote` con la cubeta.
- **Dónde:** web/navegador/lote.mjs:31-32; web/navegador/disco.mjs:75-79; web/navegador/mkw.mjs:2848

#### C5. Escribir la caché en bloques grandes y sin copias de más

*Media · PC y celular · Un jugador y sala · 1–2 días · Leído en el código*

- **Qué pasa:** Cada bloque de 256 KB es una escritura en Cache Storage (unas 800 en el primer minuto) y cada lectura se copia 2 o 3 veces en JavaScript. Sospecha: el antivirus revisa cientos de archivos nuevos.
- **Arreglo:** Guardar en Cache Storage bloques de 1–2 MB (manteniendo los de 256 KB en la memoria), escribir en ráfagas espaciadas y cambiar las copias por vistas (`subarray`) donde se pueda.
- **Gana:** menos trabajo de disco y de hilo en la 1.ª visita
- **Se comprueba:** escrituras por minuto y tareas largas del arranque (V2).
- **Dónde:** web/navegador/disco.mjs:146-168,349

#### C6. Armar los archivos del juego (MEMFS) sin una tarea larga

*Media · PC y celular · Un jugador y sala · 1 día · Leído en el código*

- **Qué pasa:** `armarArchivos` crea más de 6.000 nodos de MEMFS y copia 9,9 MB en el `preRun`, todo en una sola tarea que nunca se midió.
- **Arreglo:** Medirla (V2); si pasa de 50 ms, crear los nodos perezosos (sin copiar hasta el primer `open`) o partirla en trozos con `scheduler.yield()` antes de `callMain`.
- **Gana:** una tarea larga menos al arrancar
- **Se comprueba:** tareas largas desde la navegación.
- **Dónde:** web/navegador/mkw.mjs:2599-2615

#### C7. La precarga de la sala sin el bloque de 122 MB que nadie usa

*Alta · PC y celular · Sala · horas · Leído en el código*

- **Qué pasa:** Apenas se entra al vestíbulo, en todos los PCs a la vez, la precarga arma el programa descomprimido (122 MB) como un ArrayBuffer que no se usa, y corre 24 descargas a la vez en el mismo hilo que el vestíbulo.
- **Arreglo:** Leer el cuerpo con un `WritableStream` que descarta (solo hace falta llenar la caché HTTP), con 2–4 descargas a la vez y la cubeta de C4.
- **Gana:** 122 MB menos de memoria en el vestíbulo y menos picos
- **Se comprueba:** memoria de la pestaña en el vestíbulo; `prueba-precarga.mjs`.
- **Dónde:** web/navegador/mkw.mjs:2796-2859 (2838, 2848); colabtex/src/juegos/mkw.js:356-366 (sitio)

#### C8. Compilar el programa antes de la carrera y conservar su caché de código

*Alta · PC y celular · Un jugador y sala · 2–3 días · Dato de la plataforma*

- **Qué pasa:** V8 compila los 108 MB de código en dos etapas: primero rápido (Liftoff) y después, en caliente, optimizado (TurboFan). Solo guarda en su caché el optimizado, y lo guarda 2 s después de la última compilación nueva. En el teléfono la 1.ª carrera va unos 21 s a 20–37 fps y después sube a 60. La precarga de la sala no compila: la compilación ocurre al empezar la copa, en todos los PCs a la vez.
- **Arreglo:** En el vestíbulo y en el título de un jugador, compilar con `WebAssembly.compileStreaming` sobre la misma URL, para que la caché de código quede lista; mantener `instantiateStreaming`, el `Content-Type: application/wasm` exacto y la URL sin token. V8 no ofrece una forma de pedir el código optimizado de entrada (las «compilation hints» siguen en propuesta), así que la parte caliente se compila jugando: por eso conviene que la 1.ª carrera no sea la primera vez que corre (U1).
- **Gana:** la 1.ª carrera más pareja, sobre todo en el teléfono
- **Se comprueba:** fps de los primeros 30 s de la 1.ª carrera en 1.ª y 2.ª visita; tiempo de `instantiate`.
- **Dónde:** web/navegador/mkw.mjs:2838; worker.js:275-283 (sitio)

#### C9. Medir y bajar la memoria de la pestaña y del proceso de GPU

*Media · PC y celular · Un jugador y sala · 1–2 días · Sospecha · Medir primero*

- **Qué pasa:** El heap del programa es de 512 MB y nunca crece; la RAM de la Wii (88 MB) se llena con memset; aurora reserva 37 MB de preparación; V8 guarda los 122 MB del programa más su código; en JavaScript hay hasta 64 MB de bloques. Nunca se midió cuánto ocupan de verdad la pestaña y el proceso de GPU (931 pipelines más las texturas). Estimado: 0,7–1,2 GB. En un PC de 8 GB eso puede mandar memoria a disco y congelar todo; en un teléfono de 4–6 GB, Android puede matar la pestaña.
- **Arreglo:** Medir por proceso (V2); después ajustar el tamaño de la memoria de bloques según `navigator.deviceMemory`, bajar `INITIAL_MEMORY` a lo que se usa de verdad y quitar copias.
- **Gana:** sin paginación en PCs de 8 GB ni pestañas muertas en teléfonos
- **Se comprueba:** huella de memoria por proceso con 1 y con 2 pestañas.
- **Dónde:** herramientas/compilar-web.py:525; parches/runtime-web.diff:2101-2106; parches/aurora-web.diff:154; web/navegador/disco.mjs:74

#### C10. Pestaña oculta: no gastar CPU de más

*Media · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** Con la pestaña oculta y sin enganche al monitor el juego sigue corriendo a ritmo completo (el reloj va por MessageChannel), y la espera entre cuadros despierta cada 1 ms.
- **Arreglo:** Un jugador: pausar el juego y el sonido al ocultar. Sala: seguir simulando sin dibujar (ver R9). Cambiar la espera de 1 ms por un solo `setTimeout` hasta el cuadro siguiente.
- **Gana:** CPU libre para lo que sí se ve y menos batería
- **Se comprueba:** CPU con la pestaña oculta.
- **Dónde:** web/navegador/mkw.mjs:541-548; parches/runtime-web.diff:1434,1459

### D · Descargas: nada se baja durante la carrera

Respuesta al punto 3. Cada lectura del disco que no está en memoria **congela el juego entero** hasta que llega: los hilos del juego son fibras dentro de un solo hilo y JSPI suspende todo (lógica, dibujo, sonido y los botones del lockstep). Hoy las cargas encadenan pedidos de a uno y nada se baja por adelantado para la pista elegida. Lo medido usa 50 ms de latencia y un servidor local; con la red real (el Worker en `workers.dev`) es unas 4 veces peor.

#### D1. Paquete de carrera: todo lo de la carrera, bajado y fijo en memoria antes de la cuenta

*Urgente · PC y celular · Un jugador y sala · 1–2 semanas · Medido · Volver a subir R2*

- **Qué pasa:** No se baja por adelantado: la pista elegida y su música, los karts y voces de los 12, la fanfarria de meta, la música de la última vuelta ni el kart del fantasma. La carga de la sala esperó al disco 412 + 695 + 815 ms (Piloto Uno) y terminó en «me trabé 303 ms» al largar. Lo de la última vuelta y la meta se abre al final, en plena carrera (V3).
- **Arreglo:** Un manifiesto `carreras.json`, grabado con Chrome sin ventana como `fotos-pistas.mjs` (`?modo=directa&pistas=N&trazaDisco=1` + `mkwLecturas()`; unas 2–3 h para las ~222 pistas), más las reglas de nombres: pista → `Tracks/<n>.szs`; música `<n>_N` y `_F`; kart `<veh>-<pj>[-<skin>].szs`; voces `GRP_VO_<PJ>`. En la sala: bajar el paquete durante los 45 s de elección y el de la carrera siguiente durante el descanso. En un jugador: en el gancho de `RacedataScenario::Init` (`rr_overlay_8052FB90`, ya envuelto) la página lee los 12 puestos y pide todo en un lote; en GP, las 4 pistas al elegir la copa; en Contrarreloj, en la pantalla 0x71 con el kart que dice la cabecera del RKG. El paquete queda fijo en memoria (como `diminutos.bin`) hasta la meta. La sala no larga sin el «listo» de todos, y la página sortea también las skins de la 1.ª carrera (hoy las sortea RR y no se saben antes).
- **Gana:** cero esperas al disco desde la cuenta hasta la meta
- **Se comprueba:** `prueba-sala` y `medir-sitio` con perfil nuevo y la carrera completa: 0 lecturas a la red mientras la carrera corre.
- **Dónde:** web/navegador/mkw.mjs:1954-1960,1984; web/navegador/lockstep.mjs:1419; build/web/navegador/imagenes/archivos.json; web/navegador/fotos-pistas.mjs:44-49
- **Nota:** Del Oppo (2026-10-30, bitácora §173): en la 1.ª visita del teléfono, menús (s. 53–62) y presentación (62–70) a 1–2 fps con el disco esperando 600–1.280 ms cada segundo. Lo atacan la semilla nueva (D9, §168) y el paquete de carrera (D4/U2, §169); medirlo con una visita nueva en la gama baja simulada (`medir-carrera-entera --baja`).

#### D2. Pausar todas las descargas de fondo durante la carrera

*Urgente · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** La fila baja (59 MB: la semilla de bloques y las voces de las CPU) arranca en el cuadro 300 y solo se aparta 300 ms después de que el juego espera algo; no sabe cuándo hay carrera. En la 1.ª visita, con la red de una casa, sigue bajando en la primera carrera.
- **Arreglo:** Pausar toda la fila de fondo mientras la carrera corre (etapa de Raceinfo menor que 4) y reanudarla en la meta o en los menús. Si en la carrera falta algo, anotarlo (`mkwFaltas`) para completar el manifiesto.
- **Gana:** la red y el hilo libres durante la carrera
- **Se comprueba:** `medir-sitio --red 20` con la carrera entera: 0 bytes de fondo en carrera.
- **Dónde:** web/navegador/disco.mjs:221; web/navegador/mkw.mjs:2439-2448,2518-2596

#### D3. Dar prioridad a lo que el juego está esperando

*Alta · PC y celular · Un jugador y sala · 1 día · Medido*

- **Qué pasa:** Solo 2 de 463 pedazos salieron como urgentes: el juego casi siempre esperó un pedido de fondo que ya iba en vuelo, y ese pedido no se promueve. Dentro de un lote los pedazos llegan en fila, cada uno detrás de los anteriores (§93.2: unas 50 esperas, unos 8 s).
- **Arreglo:** Si el juego pide un bloque que va dentro de un lote de fondo grande, pedirlo aparte como urgente; con lotes de fondo chicos (2–4 MB) lo urgente nunca queda tapado.
- **Gana:** cargas de carrera más cortas
- **Se comprueba:** bancos `lote` y `disco`; muchos más urgentes en `-v1-lotes.json`.
- **Dónde:** web/navegador/disco.mjs:295,346; web/navegador/lote.mjs:99-117

#### D4. Los karts de las CPU, en un solo lote

*Alta · PC y celular · Un jugador · 1–2 días · Medido*

- **Qué pasa:** En un jugador, los 11 karts que sortea el juego se piden de a uno, 76–80 ms cada uno (lotes 98 a 108, de 51,0 a 51,8 s): casi un segundo de carga solo en eso.
- **Arreglo:** En el gancho de Racedata la página ya sabe los 12 puestos: pedir todos los karts y voces en un lote antes de que el juego los lea (es la parte de un jugador de D1).
- **Gana:** unos 0,8 s menos de carga por carrera
- **Se comprueba:** los karts llegan en una sola ida y vuelta.
- **Dónde:** web/juego/semillas_nativo.cpp; build/web/datos/medir-sitio/*-v1-lotes.json

#### D5. Una versión por archivo: subir algo no borra la caché de todos

*Alta · PC y celular · Un jugador y sala · 3–4 días · Leído en el código · Volver a subir R2 · Lo hace el dueño*

- **Qué pasa:** La versión es global: la huella de los 7.324 objetos. Cualquier subida (un `mkw.wasm` nuevo, un `bloques.json` nuevo) borra lo guardado de todos los jugadores y los devuelve a la «1.ª visita», con el congelamiento incluido. Todas las fases que recompilan el juego lo dispararían.
- **Arreglo:** Un `manifiesto.json` con una huella por archivo; `disco.mjs` guarda cada archivo con su huella y solo borra lo que cambió; el Worker sirve por huella. Hay que subir el manifiesto nuevo y volver a pegar el Worker.
- **Gana:** una actualización ya no obliga a bajar todo de nuevo
- **Se comprueba:** subir un archivo en el R2 de mentira (`prueba-subir-r2.mjs`) y que el resto siga en caché.
- **Dónde:** web/navegador/disco.mjs:105; herramientas/subir-r2.mjs:121-122

#### D6. Pedir almacenamiento persistente

*Media · PC y celular · Un jugador y sala · horas · Dato de la plataforma*

- **Qué pasa:** La persistencia no está concedida («almacenamiento persistente: no»). Sin ella, con poco espacio en el disco, Chrome borra el origen entero empezando por el menos usado: todo lo bajado del juego.
- **Arreglo:** Llamar a `navigator.storage.persist()` al terminar la 1.ª carga (Chrome lo concede sin preguntar según el uso del sitio) y mostrar el estado en «Tu partida».
- **Gana:** menos «1.ª visitas» repetidas
- **Se comprueba:** `navigator.storage.persisted()` después de dos visitas.
- **Dónde:** web/navegador/disco.mjs

#### D7. Dominio propio para el Worker (la caché del borde de Cloudflare)

*Alta · PC y celular · Un jugador y sala · horas (dueño) · Dato de la plataforma · Lo hace el dueño*

- **Qué pasa:** El Worker vive en `*.workers.dev`, donde la Cache API no funciona: cada pedazo va hasta R2. `docs/publicar.md` estima unos 150 ms más por pedido. El Worker ya tiene escrita la caché del borde, pero solo se activa con un dominio propio.
- **Arreglo:** Un dominio propio en Cloudflare para el Worker (y para la página del juego si se hace P9).
- **Gana:** de unos 200 a unos 20–50 ms por pedido (estimado) y menos operaciones de R2
- **Se comprueba:** cabecera `X-Borde: HIT` y ms por pedido en `medir-sitio`.
- **Dónde:** terceros/Paginita-Pro/juegos/bt3/fuente/disco/worker.js:12-16; docs/publicar.md:110-111

#### D8. Los videos de los menús (THP) sin cortes

*Media · PC y celular · Un jugador · 2–4 días · Medido · Volver a subir R2*

- **Qué pasa:** Los THP se leen mientras se reproducen: 89 MB en la 1.ª visita (`cup_select`, 34 MB en 5,2 s, unos 52 Mbit/s). El juego esperó 80–160 ms por segundo en esos tramos. Además `thp_nativo.cpp` llena con ceros y copia 128 KB en cada cuadro de video.
- **Arreglo:** Bajarlos a ritmo durante el título (con la cubeta de C4) o recodificarlos más livianos (hay que volver a subirlos a R2), y quitar el llenado y la copia de cada cuadro.
- **Gana:** menús sin tirones en la 1.ª visita
- **Se comprueba:** menús de la 1.ª visita con 10 Mbit/s o menos.
- **Dónde:** web/juego/thp_nativo.cpp:143-145; web/navegador/disco.mjs (lectura seguida)

#### D9. Regrabar `bloques.json` con el camino real

*Media · PC y celular · Un jugador y sala · 1 día · Medido · Volver a subir R2*

- **Qué pasa:** `bloques.json` sale de 6 corridas del mismo guion y solo trae las pistas 0 y 54.
- **Arreglo:** Regrabarlo con el camino de verdad (inicio → sala → personaje → carrera) y dejar lo de cada pista al paquete de D1. Subirlo a R2.
- **Gana:** menos lecturas sueltas en la 1.ª visita
- **Se comprueba:** `guion.mjs --semilla` 3 veces y `medir-sitio --visitas 2`.
- **Dónde:** build/web/navegador/bloques.json
- **Nota:** Del Oppo (2026-10-30, bitácora §173): la carga del teléfono espera al disco 600–1.280 ms cada segundo en los menús y la presentación (1–2 fps): la semilla nueva es parte del remedio; medirlo con una visita nueva en la gama baja simulada (`medir-carrera-entera --baja`).

#### D10. Leer sin suspender cuando el dato ya está en memoria

*Media · PC y celular · Un jugador y sala · 1 día · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** `mkw_web_lee_rango` suspende el juego (JSPI) aunque el pedazo ya esté en memoria: unas 8 lecturas por segundo en la carrera de la sala. Cada suspensión deja correr dentro del cuadro todas las tareas que estaban pendientes (red, sonido, página).
- **Arreglo:** Un camino sincrónico: una llamada EM_JS que copia si el dato ya está, y suspender solo cuando de verdad hay que esperar.
- **Gana:** menos cortes dentro del cuadro
- **Se comprueba:** suspensiones por cuadro en el medidor (V4).
- **Dónde:** parches/runtime-web.diff:1085-1093; web/navegador/mkw.mjs:1083-1102

#### D11. El disco en un Worker y contar bytes sin clonar respuestas

*Media · PC y celular · Un jugador y sala · 3–5 días · Leído en el código*

- **Qué pasa:** `descargas.mjs` (§106) clona **cada** respuesta para contar sus bytes, y todo el disco (lotes, Cache Storage, descompresión) trabaja en el mismo hilo que el juego.
- **Arreglo:** Contar con un `TransformStream` o con el `Content-Length`, y mover `disco.mjs` y `lote.mjs` a un Worker dedicado que entrega los bloques por `postMessage` transfiriéndolos (sin copiar).
- **Gana:** el hilo del juego deja de cargar con las descargas
- **Se comprueba:** tareas largas y «hilo ocupado» durante la 1.ª visita.
- **Dónde:** web/navegador/descargas.mjs:107-124; web/navegador/disco.mjs; web/navegador/lote.mjs

#### D12. El fantasma de la página, bajado antes de la cuenta

*Media · PC y celular · Un jugador · 1 día · Leído en el código*

- **Qué pasa:** En Contrarreloj el fantasma de la página llega por Firebase (la tabla de los 10 mejores y hasta 10 bajadas en serie). No traba, pero si llega tarde se corre contra el experto.
- **Arreglo:** Pedirlo en paralelo apenas se elige la pista y esperarlo antes de la cuenta, con un tope de tiempo.
- **Gana:** siempre el fantasma que corresponde
- **Se comprueba:** `prueba-fantasma.mjs` con la nube de mentira lenta.
- **Dónde:** web/navegador/fantasma-pagina.mjs:87-110

#### D13. Guardar la partida y la lista de pipelines fuera de la carrera

*Media · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** Si aparece un pipeline nuevo en carrera (ya es un tirón), a los 10 s se arma la lista entera (`_mkw_web_pipelines_armar` + `HEAPU8.slice` + IndexedDB): 2–10 ms en el teléfono, un segundo tirón. `guardado.mjs` lee 2,8 MB y los guarda en IndexedDB cada vez que el juego guarda.
- **Arreglo:** Dejar las dos cosas para los menús o el descanso, con `requestIdleCallback` y un plazo.
- **Gana:** sin picos de guardado en la carrera
- **Se comprueba:** tareas largas durante la carrera = 0.
- **Dónde:** web/navegador/pipelines.mjs:85-106; web/navegador/guardado.mjs:104-130

#### D14. El tope diario del Worker gratis (100.000 pedidos)

*Media · PC y celular · Un jugador y sala · horas (dueño) · Dato de la plataforma · Lo hace el dueño*

- **Qué pasa:** Con el plan gratis, pasados 100.000 pedidos en el día el Worker responde Error 1027 hasta las 00:00 UTC: nadie puede bajar el juego. Hoy son 123 llamadas en la 1.ª visita y 16 en la 2.ª (§104): alcanza para unas 800 primeras visitas por día. Los aciertos de la caché del borde igual cuentan como pedido del Worker.
- **Arreglo:** Vigilar el conteo en el panel de Cloudflare; si se acerca, el plan pago (US$5 al mes, 10 millones de pedidos por mes). El paquete de carrera (D1) y los lotes bajan el conteo.
- **Gana:** que el juego no deje de bajar un día de muchas visitas
- **Se comprueba:** pedidos por visita en `medir-sitio --visitas 2`.
- **Dónde:** docs/publicar.md; bitácora §104

### U · Un jugador

El dueño avisó que un jugador también va mal. Casi toda la lista vale igual (carga, descargas, motor, gráficos, página); esto es lo propio de un jugador. Contrarreloj (1 kart y hasta 3 fantasmas) pesa mucho menos que 12 karts: si ahí también va mal, el problema es la base, no la simulación.

#### U1. El precalentado no sigue dentro de la carrera

*Urgente · PC y celular · Un jugador · horas · Medido*

- **Qué pasa:** Fuera de la sala nada espera al precalentado. En el teléfono, el modo «tarde» tardó 41 s y se metió en la 1.ª carrera: los primeros ~21 s fueron a 20–37 fps.
- **Arreglo:** Con el precalentado con tope (C1), esperar en el título o en la pantalla de personaje a que termine lo de los menús, con una barra; lo de cada pista va en su carga (C2). Si el jugador entra antes, pausarlo durante la carrera y seguir en los menús.
- **Gana:** la 1.ª carrera a 60 desde la cuenta
- **Se comprueba:** fps de los primeros 30 s de la 1.ª carrera con la caché vacía, en PC y en el teléfono.
- **Dónde:** web/navegador/mkw.mjs:865-874; web/navegador/preparacion.mjs

#### U2. GP y VS: pedir la pista apenas se elige

*Alta · PC y celular · Un jugador · 2–3 días · Medido · Volver a subir R2*

- **Qué pasa:** En GP y VS (sección 0x48) la pista se sabe recién al elegirla y la carga empieza 1–3 s después; las CPU las sortea el juego, y de ahí la cadena de karts pedidos de a uno (D4).
- **Arreglo:** Pedir la pista y su música apenas se elige (gancho de la pantalla de pistas) y los karts en el gancho de Racedata; en GP, las 4 pistas al elegir la copa. Es la parte de un jugador de D1.
- **Gana:** cargas sin esperas al disco
- **Se comprueba:** `medir-sitio` con pistas que no están en la semilla.
- **Dónde:** rr_overlay_8052FB90 (gancho de Racedata); web/navegador/directo.mjs

#### U3. Contrarreloj como prueba barata para separar causas

*Media · PC y celular · Un jugador · horas · Leído en el código · Medir primero*

- **Qué pasa:** Cada fantasma es la física de un kart movida por los botones del `.rkg` más un modelo translúcido: mucho menos CPU que 12 karts. Si en el teléfono Contrarreloj también va mal, frena la base (precalentado, GPU, aurora), no la simulación.
- **Arreglo:** Medir Contrarreloj en el teléfono (1.ª y 2.ª visita) junto con V1, antes de optimizar la simulación.
- **Gana:** saber dónde atacar primero
- **Se comprueba:** el informe de rendimiento en Contrarreloj contra el de una carrera de 12.
- **Dónde:** web/navegador/fantasma-pagina.mjs

#### U4. Reloj del juego enganchado al monitor (sin cuadros repetidos)

*Media · PC y celular · Un jugador · 1 día · Medido*

- **Qué pasa:** El reloj VI del juego va a 59,94 Hz y el monitor a 60 Hz (o al que sea): cada tanto un cuadro se repite o se salta. §114.8 propone ampliar el enganche hasta ~1 % de diferencia.
- **Arreglo:** Enganchar el reloj del juego al del monitor cuando difieren 1 % o menos (en un jugador; en la sala el ritmo lo manda el lockstep).
- **Gana:** suavidad: sin un cuadro repetido cada pocos segundos
- **Se comprueba:** refrescos repetidos y saltados en `prueba-navegador` y `medir-enlinea.mjs`.
- **Dónde:** parches/runtime-web.diff:1491-1528 (VI); web/navegador/mkw.mjs:239 (ENGANCHE)

### R · Red y sala: que el lento no frene a nadie

Respuesta al punto 1. Hoy la sala es un **lockstep sobre una malla WebRTC**: cada consola simula los 12 karts y no puede correr el cuadro f sin el paquete de la autoridad y los botones de cada humano no relevado. Es una cadena de compuertas AND: la salida avanza cuando todas las entradas llegaron. Por eso la traba de uno la pagan los demás. Ver también «¿Se puede hacer asíncrono?».

#### R1. El árbitro como modo normal (todos esperan a uno solo)

*Alta · PC y celular · Sala · ~1 semana · Leído en el código*

- **Qué pasa:** Cada consola espera los botones de todas: con 12 humanos manda y recibe 660 mensajes por segundo, y la traba de uno cuesta 34–322 ms a los demás (§101.5). El relevo ya hace que la autoridad escriba los botones de un lento, pero recién después de 2 ratos malos seguidos (1 s o más).
- **Arreglo:** Que la autoridad (la PC más estable) escriba **siempre** los botones de todos en su paquete: usa los que le llegaron a tiempo y, si no llegaron, repite el último (como hace hoy el relevo). Cada uno manda sus botones solo a la autoridad y a un suplente; todos esperan solo a la autoridad; la sincronía de §80b deja de hacer falta. El formato ya existe (masc, slots, sust). Primero como opción `?arbitro=1`.
- **Gana:** la traba de un humano le cuesta ~0 ms a los demás; los que no son árbitro bajan de 660 + 660 a 60 + 60 mensajes por segundo. Precio: +1–2 cuadros de retraso y unos 2–3 Mbit/s de subida para el árbitro
- **Se comprueba:** `prueba-relevo --trabas=8`, `prueba-sincro --lento` y `prueba-doce`: esperas, mensajes por segundo y ms de JavaScript por cuadro.
- **Dónde:** web/navegador/lockstep.mjs:278-295,424-438,707-766,897-919

#### R2. Simular a 60 aunque se dibuje menos (separar la simulación del dibujo)

*Alta · PC y celular · Un jugador y sala · 1–1,5 semanas · Leído en el código · Decompilar · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Un cuadro es, en fila: lógica → dibujo del juego → aurora → presentar → espera del VI. Una tarjeta lenta alarga el cuadro entero (en el Oppo, «juego» 33,4 y «tarjeta» 33,8 ms). Pulsar ya trae un salto de dibujo para alcanzar al reloj (`rr_kamek_81806568`), pero en la sala está apagado porque el dibujo calcula cosas que la lógica lee: `ModelDirector::Update` copia la posición de cada kart a su modelo y la IA la usa.
- **Arreglo:** Partir el dibujo en dos: en un cuadro saltado, correr solo lo que la lógica lee (decompilar quién lee qué, con el vigía de §62) y saltar el envío a la GPU. Paso conservador previo: el juego dibuja siempre, pero aurora descarta el cuadro (no codifica, no envía, no presenta) si la tarjeta tiene más de un cuadro pendiente. Un jugador también gana: el salto de RR se vuelve más barato.
- **Gana:** el teléfono simula a 60 aunque dibuje a 30: ni frena a la sala ni se queda atrás
- **Se comprueba:** `prueba-sincro --directa` con B saltando dibujos al azar: la huella ampliada (R5) sigue igual 3 vueltas; 60 cuadros de lógica por segundo en el teléfono (V5).
- **Dónde:** web/juego/lockstep_nativo.cpp:161-185; parches/aurora-web.diff:11-53,300,859-876; parches/runtime-web.diff:1491-1528

#### R3. El ping lleva el cuadro: pausar al que «se oye» pero no avanza

*Alta · PC y celular · Sala · horas · Leído en el código*

- **Qué pasa:** Cuando una pestaña se traba viva (por ejemplo, JSPI esperando el disco), cualquier mensaje suyo cuenta como «oído» y sus pings siguen saliendo cada 500 ms: la pausa de los 150 ms no llega y los demás esperan hasta el corte de 2 s.
- **Arreglo:** Que el ping y el informe lleven el último cuadro simulado; si ese cuadro no avanza en 150 ms, pausar al jugador igual.
- **Gana:** las trabas «vivas» dejan de costarle hasta 2 s a los demás
- **Se comprueba:** una traba viva de mentira (un `await` largo dentro de `pad`) en el banco `relevo`.
- **Dónde:** web/navegador/lockstep.mjs:325-329,1000,1201

#### R4. Lockstep sin basura por cuadro

*Alta · PC y celular · Sala · 1–2 días · Leído en el código*

- **Qué pasa:** `paqueteA` arma listas y llama a `bits()` en cada cuadro; `alBinario` crea un arreglo de 12 por entrada antes de ver si es repetida; `pad()` crea un `Int32Array(96)`, 12 `Array.from` y más objetos: unos 250–300 objetos por cuadro. Los `Map` por cuadro solo se vacían al empezar otra carrera (unas 216 mil entradas en 5 min con 12). `vista` y `votos` (cada 500 ms) crecen como n² o n³ y arman texto. Con 12 humanos llegan 660 eventos `onmessage` por segundo al hilo del juego.
- **Arreglo:** Anillos tipados de tamaño fijo (el cuadro módulo 256), búferes de envío reusados, tablas podadas a cada rato y votos con números en vez de texto.
- **Gana:** menos limpiezas de basura (1–5 ms cada una en el teléfono)
- **Se comprueba:** traza de Chrome (`medir-cpu.sh`): limpiezas Scavenge y MarkCompact por carrera.
- **Dónde:** web/navegador/lockstep.mjs:271-295,769-892 (859-870); web/navegador/malla.mjs

#### R5. Huella ampliada: saber qué se separó y cuándo

*Alta · PC y celular · Sala · 1–2 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** La huella solo compara los bits del avance de los 12 y un hash de los botones, cada 120 cuadros: detecta tarde y no dice qué se separó. Es la red de seguridad de todo lo que toca la simulación (R2, G1, M1).
- **Arreglo:** Sumar posición, velocidad, objetos y semillas de los 12 cada 30 cuadros, y un volcado de lo que difiere cuando no coincide.
- **Gana:** detectar una desincronía en medio segundo y saber dónde está
- **Se comprueba:** banco `lockstep` y `prueba-sincro` con una desincronía provocada a propósito.
- **Dónde:** web/navegador/lockstep.mjs:886-887,1405-1411

#### R6. PC y celular en la misma sala: probar que den la misma carrera

*Urgente · PC y celular · Sala · 2–3 días + una sesión · Leído en el código · Lo hace el dueño*

- **Qué pasa:** Nunca se probó el lockstep entre un PC (procesador x86) y un teléfono (ARM): `prueba-doce` son 12 pestañas en un mismo PC, y los bancos `paridad` y `fma` solo corrieron en x86. Riesgos: NaN que el juego guarda y lee como entero fuera de lo que ya se reescribe; valores de la tarjeta que el juego lee (`GXPeekZ`, copias asíncronas del EFB); aspectos de pantalla distintos (RR ajusta la vista al lienzo y eso puede cambiar lo que «ve» la IA); y los ajustes de gráficos de cada aparato (la fluidez 120/180 de §107 no se probó en la sala).
- **Arreglo:** Correr `paridad` y `fma` en el teléfono (no llevan nada del juego); dos pestañas, una en 16:9 y otra en 21:9; una con `&fluidez=180`; y una sala PC + teléfono de 3 carreras con la huella ampliada (R5).
- **Gana:** saber si PC con celular anda antes de optimizar para eso
- **Se comprueba:** la huella igual en las 3 carreras.
- **Dónde:** parches/runtime-web.diff (~1806: NaN); herramientas/compilar-web.py:159-165

#### R7. La autoridad, siempre la PC con más margen y más subida

*Media · PC y celular · Sala · 1 día · Leído en el código*

- **Qué pasa:** La autoridad es la única que puede frenar a todos. Hoy se elige por estabilidad, pero no mira el margen de CPU por cuadro ni la subida de su red; con el árbitro (R1) tiene que subir unos 2–3 Mbit/s con 12 jugadores.
- **Arreglo:** Sumar al puntaje el margen por cuadro (ms libres) y la subida medida; nunca un teléfono si hay un PC.
- **Gana:** menos esperas por la autoridad
- **Se comprueba:** el registro «paso la autoridad» y las esperas por la autoridad en `prueba-relevo`.
- **Dónde:** web/navegador/lockstep.mjs (puntaje de estabilidad)

#### R8. Nada grande por el canal fiable durante la carrera

*Media · PC y celular · Sala · 1 día · Dato de la plataforma*

- **Qué pasa:** Los dos canales de cada enlace (`udp` y `tcp`) van por la misma asociación SCTP, y Chrome no intercala mensajes: un mensaje grande en el canal fiable (la copia de la sala, las skins, los Mii, lo de quien vuelve tras recargar) hace esperar a los paquetes de botones.
- **Arreglo:** Partir todo mensaje del canal fiable en trozos de 1 KB o menos y no mandar nada grande con la carrera en curso; seguir repitiendo en cada paquete los cuadros sin acuse (ya se hace).
- **Gana:** sin esperas raras de 50–200 ms
- **Se comprueba:** banco `red` con un mensaje de 200 KB en plena carrera.
- **Dónde:** web/navegador/malla.mjs:111-112,273

#### R9. Pestaña oculta en la sala

*Media · PC y celular · Sala · 1 día · Sospecha · Medir primero*

- **Qué pasa:** Sin `requestAnimationFrame` los botones quedan en el último valor; no hay freno ni ráfaga; el reloj va por MessageChannel. Chrome puede estirar los temporizadores de `revisar` y `vigilancia` (sospecha: no hay prueba).
- **Arreglo:** Al ocultarse: simular sin dibujar, mandar los botones en cero después de 1 s y avisar al árbitro. Probarlo.
- **Gana:** el que cambia de pestaña no frena a nadie
- **Se comprueba:** una pestaña oculta 30 s en `prueba-sincro`.
- **Dónde:** web/navegador/controles.mjs:324-381; web/navegador/lockstep.mjs:516,788; web/navegador/mkw.mjs:541-548

#### R10. La revisión de conexiones, liviana en carrera

*Media · PC y celular · Sala · horas · Leído en el código*

- **Qué pasa:** `conexiones.mjs` llama a `pc.getStats()` piloto por piloto cada 2 s, también en carrera: con 11 pilotos son 3–15 ms en ráfagas. Cada cambio manda un mensaje al sitio, que rehace el vestíbulo.
- **Arreglo:** En carrera, un piloto por vuelta en rueda (o cada 10 s), o solo el chequeo `sano`; avisar al sitio solo cuando cambia el estado, no los ms.
- **Gana:** sin ráfagas de 3–15 ms cada 2 s
- **Se comprueba:** banco `conexiones`; tareas en carrera.
- **Dónde:** web/navegador/conexiones.mjs:63-88; web/navegador/malla.mjs:294-306; web/navegador/mkw.mjs:1493-1503

### G · Gráficos: aurora y WebGPU

aurora traduce el GX de la Wii a WebGPU. En cada cuadro vuelve a decodificar las listas de dibujo y vuelve a subir 1,1–2,5 MB (vértices, índices, uniforms), hace 200–420 dibujos WebGPU y 12 pasadas, cada una cargando y guardando color y profundidad. En la GPU de un teléfono (que dibuja por baldosas) cargar y guardar es lo caro.

#### G1. Sala: «todo a la vista» solo para la lógica, el recorte normal para el dibujo

*Urgente · PC y celular · Sala · 1–2 semanas · Medido · Decompilar · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Para no desincronizarse, la sala obliga a «todo a la vista» y a «dibujar siempre» (§62): el dibujo del juego sube de 2,1 a 6,4 ms y `RendererRaceModels::Draw` de 1,5 a 5,6 ms. Por eso el PC va a 15–17 ms en la sala (al borde de los 16,7) contra 7–9,5 ms fuera.
- **Arreglo:** Separar lo que la lógica necesita de la visibilidad (qué se actualiza: `ClipInfoMgr` y quienes lo leen) del recorte por cámara que usa el dibujo: la lógica ve «todo» y el dibujo recorta como siempre. Hay que decompilar `ClipInfoMgr` y sus lectores con el vigía de §62; la huella ampliada (R5) cuida la sincronía.
- **Gana:** −4 a −5 ms por cuadro en PC y −6 a −9 ms en el teléfono, en la sala (estimado)
- **Se comprueba:** `prueba-sincro --directa` 3 vueltas con la huella ampliada igual; `medir-cpu.sh` en la sala.
- **Dónde:** web/juego/lockstep_nativo.cpp; bitácora §62 y §85.10

#### G2. Pasadas pensadas para las GPU de los teléfonos

*Alta · PC y celular · Un jugador y sala · 3–5 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Las 12 pasadas cargan (o limpian) y guardan color y profundidad, y cada copia del EFB parte una pasada. La profundidad es `Depth32Float`. Después de la última pasada se saca una instantánea de la profundidad (`depth_peek`). En una GPU por baldosas cada cargar o guardar es ir y volver a la memoria principal: a 1080p, unos 8 MB cada vez.
- **Arreglo:** `storeOp: "discard"` para la profundidad que nadie vuelve a leer; `clear` en vez de `load` donde todo se sobrescribe; juntar pasadas cuando la copia no se lee en la misma; `depth_peek` solo cuando el juego lo pide; probar un formato de profundidad más chico donde dé lo mismo.
- **Gana:** 1–4 ms de GPU en el teléfono (estimado); poco en PC
- **Se comprueba:** `perfil-gpu.mjs` por pasada en el teléfono (V1).
- **Dónde:** aurora gfx/common.cpp:561,1411-1425,1440; webgpu/gpu.cpp:846

#### G3. No volver a subir lo que no cambió

*Urgente · PC y celular · Un jugador y sala · 1–2 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** aurora decodifica de nuevo la FIFO y las listas y vuelve a subir vértices, índices, uniforms y storage en cada cuadro (1,1–2,5 MB). `writeBuffer` es lo más caro de aurora en el perfil (2,36 %), y cada llamada pasa de wasm a JavaScript.
- **Arreglo:** Guardar entre cuadros las listas de dibujo, vértices e índices ya convertidos y subidos, invalidándolos cuando el juego escribe encima (`gx_guest_write.h`); búferes rotativos para lo que sí cambia.
- **Gana:** 0,2–0,5 ms en PC y 0,5–2 ms en el teléfono (estimado)
- **Se comprueba:** bytes y llamadas WebGPU por cuadro.
- **Dónde:** aurora gfx/common.cpp:1203-1225; gx/command_processor.cpp:2264+
- **Nota:** Del Oppo (2026-10-30, bitácora §173): 2–3,7 MB por cuadro subidos a la tarjeta en el teléfono (`kb` del informe): el principal sospechoso del lado de la CPU. Va con H12.

#### G4. Ubershader: dibujar mientras compila

*Alta · PC y celular · Un jugador y sala · 2–4 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Mientras un pipeline compila, ese dibujo se salta (cosas que aparecen tarde) o se arma de golpe (C3). En el teléfono son 931 pipelines a 100–1000 ms cada uno.
- **Arreglo:** Como hace Dolphin: un shader general que interpreta el estado del TEV y dibuja cualquier material mientras se compila el específico. Ataca de raíz el calentamiento del teléfono y el de cada pista nueva, y no toca la simulación.
- **Gana:** sin calentamiento visible; 1–4 ms menos de GPU en el teléfono (estimado)
- **Se comprueba:** primera carrera en el teléfono con la caché vacía: nada que falte ni tirones.
- **Dónde:** aurora gx/shader.cpp

#### G5. El aspecto real de la vista en el teléfono

*Alta · Celular · Un jugador y sala · 1 día · Medido*

- **Qué pasa:** El teléfono mostró 2,18:1 aunque `force_16_9` debería dejarlo en 16:9. Con una vista más angosta el cuadro bajó de 34 a 20 ms: el costo está en lo que se ve (los dibujos), no en los pixeles.
- **Arreglo:** Averiguar por qué no se aplica 16:9 en el teléfono y forzarlo. En la sala tiene que ser igual para todos (afecta lo que ve la IA, R6).
- **Gana:** 2–5 ms en el teléfono (estimado)
- **Se comprueba:** captura y aspecto medido en el teléfono.
- **Dónde:** web/navegador/mkw.mjs:2627

#### G6. Texturas comprimidas en la GPU

*Media · PC y celular · Un jugador y sala · 1–2 semanas · Dato de la plataforma · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Todas las texturas pasan a RGBA8: las CMPR (comprimidas en la Wii) ocupan 8 veces más memoria y ancho de banda; las paletas van en R16Sint.
- **Arreglo:** CMPR es casi el formato BC1: subirla así donde exista (Windows casi siempre; Android ~34 %) y pasarla a ETC2 en los teléfonos sin BC (ETC2 está en ~100 % de Android). Es solo visual: no toca la simulación.
- **Gana:** menos memoria de video y ancho de banda (sobre todo en el teléfono)
- **Se comprueba:** memoria de video y tiempo de GPU por pasada.
- **Dónde:** aurora gfx/texture_convert.hpp:13-15

#### G7. Vértices como atributos en vez de storage buffers

*Investigar · Celular · Un jugador y sala · 1–2 semanas · Sospecha · Medir primero · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Los vértices se leen desde storage buffers dentro del shader (`fetch_attr`). En GPUs Mali eso puede costar más que los atributos de vértice normales, y crece con lo que se ve.
- **Arreglo:** Medir con `perfil-gpu` en el teléfono; si pesa, usar atributos de vértice para los formatos más comunes.
- **Gana:** sin medir
- **Se comprueba:** `perfil-gpu.mjs` por pasada antes y después.
- **Dónde:** aurora gx/shader.cpp (fetch_attr)

#### G8. El medidor de GPU no puede inflar lo que mide

*Urgente · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** Con «Mostrar qué frena» (`?gpu=1` o el detalle), `perfil-gpu.mjs` envuelve unas 1.000–2.000 llamadas WebGPU por cuadro con `function(...a)` + `apply` y un `WeakMap.get` por dibujo: 0,2–1 ms por cuadro en PC, 1–3 ms en el teléfono y unos 100 KB de basura por cuadro. Su cabecera dice que es «barato» y no lo es: infla justo lo que se quiere medir en el teléfono.
- **Arreglo:** Medir por ventanas: instalar, contar 2 s y devolver los métodos originales; envolturas con argumentos fijos; la pasada actual en una variable; no envolver `setPipeline` ni `setBindGroup` salvo en el modo de tiempos.
- **Gana:** mediciones del teléfono que se pueden creer
- **Se comprueba:** CPU por cuadro igual con y sin el detalle fuera de la ventana de medición.
- **Dónde:** web/navegador/perfil-gpu.mjs:36-49,87-104; web/navegador/mkw.mjs:287,327

#### G9. aurora en su propio hilo (como el «dual core» de Dolphin)

*Urgente · PC y celular · Un jugador y sala · 2–4 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** **WiiCompiled v0.9.0 ya trae el GX en su propio hilo (#325, en el nativo)**: se parte de eso (N15). Todo va en un solo hilo: el juego, aurora (codificar y enviar) y la mezcla de sonido. El hilo de cuadro de aurora está apagado en la web.
- **Arreglo:** Necesita memoria compartida (P9): aurora dueña del dispositivo WebGPU en otro hilo y el juego en el suyo. Cuidado: si la lógica depende de cuándo termina la GPU (draw-done, PeekZ) puede romper el lockstep.
- **Gana:** ~0,8 ms en PC y 1–3 ms en el teléfono (estimado)
- **Se comprueba:** huella ampliada y `medir-cpu.sh`.
- **Dónde:** parches/aurora-web.diff:59-65 (frame_worker_requested)

#### G10. Bajar la resolución no es la palanca

*Media · Celular · Un jugador y sala · — · Medido*

- **Qué pasa:** Con la resolución interna fija (640×528) el teléfono bajó de 34 a 20 ms solo al angostar la vista: el costo está en los dibujos y no en los pixeles. Además la meta del dueño es 60 fps «sin sacrificar nada».
- **Arreglo:** Dejar las opciones de §107 como elección del jugador, no como arreglo, y no proponer menos karts ni menos efectos. El trabajo va por G2, G3, G4 y G5.
- **Gana:** no gastar tiempo en algo que no resuelve
- **Se comprueba:** —
- **Dónde:** web/navegador/graficos.mjs; CLAUDE.md (reglas)

### M · El motor: traductor, WebAssembly y runtime

El juego corre traducido de PowerPC a C++ y de ahí a WebAssembly. Ninguna función domina el perfil: un ~60 % se reparte entre miles de funciones traducidas. Por eso lo que más rinde es bajar lo que pagan todas: el acceso a la memoria y las llamadas. Todo lo de esta sección exige recompilar el `.wasm` y volver a subirlo a R2, y nada puede cambiar un solo bit de los resultados (sala y fantasmas).

#### M1. Accesos a memoria rápidos: rangos y psq con puntero directo

*Urgente · PC y celular · Un jugador y sala · 3–5 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** El traductor junta los accesos de la misma base en rangos (12.638 rangos, unos 177.000 sitios), pero en wasm `ResolveRangeHost` siempre devuelve null: cada acceso cae a `Read/WriteResolvedFallback*`, marcadas `noinline cold`. Eso incluye los guardados de registros de cada prólogo y epílogo, que corren en cada llamada. Las funciones de puntero directo de psq también devuelven null.
- **Arreglo:** Resolver el rango con la tabla de páginas de 1 MiB (si no cruza de página ni toca código o E/S) y usar un puntero directo; lo mismo en psq. Respeta las mismas reglas de escritura: no cambia ningún resultado.
- **Gana:** 0,3–1 ms por cuadro en PC y 0,5–2 ms en el teléfono (estimado)
- **Se comprueba:** caídas al camino lento por cuadro (V4); bancos `paridad` y fantasmas expertos de RR iguales.
- **Dónde:** runtime/include/memory_access.h:85-91,229-245; isa/ppc_isa_quantized.h:265-286; guest_flat_memory.h:87

#### M2. Escrituras en línea

*Urgente · PC y celular · Un jugador y sala · 1–2 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** `Memory::Write32` y `WriteFloat32` son `inline` simple (no forzado) y aparecen en el perfil como funciones propias (2,04 % y 1,78 %); `TryWriteGuestScalar` revisa subtablas de 4 KiB y guardas de código en cada escritura.
- **Arreglo:** Forzar en línea el camino rápido (`always_inline`) y dejar fuera de línea solo lo raro (E/S, código).
- **Gana:** parte del ~4,9 % que se va en el acceso a memoria
- **Se comprueba:** perfil con CPU ×4 antes y después; `paridad`.
- **Dónde:** memory_access.h:380,729,739

#### M3. Llamadas indirectas más baratas

*Media · PC y celular · Un jugador y sala · 2–3 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** `TryDispatchRawCpuTarget` (1,68 %) arma 3 guardas en cada llamada (la dirección, r14–r31 y f14–f31); los nativos copian siempre r14–r31; el memo es de 512 entradas.
- **Arreglo:** No copiar r14–r31 en los nativos del sistema que no los tocan, un memo más grande y un atajo en línea para los destinos más llamados (sacados de un perfil).
- **Gana:** 0,1–0,2 ms en PC y 0,2–0,5 ms en el teléfono (estimado)
- **Se comprueba:** despachos por cuadro y aciertos del memo (V4).
- **Dónde:** abi_bridge.h:150,219,306,438

#### M4. Versiones nativas exactas de PSMTX, VEC, memcpy y memset

*Media · PC y celular · Un jugador y sala · 1 semana · Leído en el código · Decompilar · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** `PSMTXConcat` (1,37 %) y compañía corren traducidas instrucción por instrucción, con la coma flotante de la Wii hecha en software.
- **Arreglo:** Versiones propias en C++ que den exactamente los mismos bits (mismo orden de operaciones, mismo redondeo de `fmuls`, FMA exacta), probadas contra la versión traducida con millones de entradas al azar y con los fantasmas.
- **Gana:** 0,1–0,4 ms en PC y 0,2–0,8 ms en el teléfono (estimado)
- **Se comprueba:** un banco de entradas al azar comparado bit a bit; fantasmas expertos de RR.
- **Dónde:** isa/ppc_isa_float.h:204,245,478; isa/ppc_isa_wasm_neon.h:26,94,192

#### M5. La FMA de dos carriles de una vez

*Investigar · PC y celular · Un jugador y sala · 2–3 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** La FMA exacta (producto en double + TwoSum + redondeo a impar) cuesta 2,5 ns en float y 5 ns en double, y `vfma_f32` calcula sus 2 carriles de a uno. Hay 19.851 `PpcFmulsInline` y 1.213 `PPC_PsMadd`.
- **Arreglo:** Calcular los 2 carriles a la vez con operaciones `f64x2` (exactas según IEEE: mismos bits). No usar `relaxed_madd` (M11).
- **Gana:** parte del costo de la coma flotante; N1 midió ~0 en el título: se hace solo si N13 la ve pesar en la carrera
- **Se comprueba:** banco `fma` (40 millones de casos) en PC y en el teléfono.
- **Dónde:** isa/ppc_isa_wasm_neon.h:192

#### M6. Compilar guiado por un perfil (PGO)

*Urgente · PC y celular · Un jugador y sala · 3–5 días · Sospecha · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** El compilador no sabe qué ramas son calientes y ordena el código a ciegas.
- **Arreglo:** Perfilar el juego corriendo en Node (`web/node/correr.mjs`) y recompilar con ese perfil. No cambia la coma flotante (sin fast-math) y todos corren el mismo `.wasm`: sigue siendo determinista. Alternativa más liviana: los branch hints de wasm (Chrome 137).
- **Gana:** 5–10 % de CPU (estimado)
- **Se comprueba:** `medir-cpu.sh` antes y después; `paridad`.
- **Dónde:** herramientas/compilar-web.py:163

#### M7. ThinLTO del runtime y aurora

*Alta · PC y celular · Un jugador y sala · 1–2 días · Sospecha · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** El enlace va con `-O2` y sin LTO. El juego son 265 MB de C++ (el LTO completo no es práctico), pero el runtime y aurora sí se pueden.
- **Arreglo:** ThinLTO solo para el runtime y aurora, y medir. (`-O3` y `wasm-opt -O3` ya se probaron sin ganancia, §54.)
- **Gana:** 2–5 % (estimado)
- **Se comprueba:** `medir-cpu.sh`.
- **Dónde:** herramientas/compilar-web.py:519-527

#### M8. Pasadas propias del traductor

*Urgente · PC y celular · Un jugador y sala · 2–3 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** El traductor es la capa que toca cada instrucción: prólogos que guardan registros en la memoria de la Wii, rangos que se cortan en cada llamada, guardas repetidas.
- **Arreglo:** Pasadas propias guardadas en `parches/`: la pila directa en los prólogos, rangos que crucen llamadas, menos guardas y `return_call` (tail calls, en Chrome desde 112) para los saltos `b` a otra función. Solo si conservan la semántica (paridad, huella y fantasmas).
- **Gana:** 5–15 % de CPU (estimado, en parte solapado con M1 y M3)
- **Se comprueba:** `paridad` 22/0, fantasmas y huella.
- **Dónde:** terceros/Wiicompiled (CodeGen/GuestMemoryRangeLowering.cs)

#### M9. La mezcla de sonido AX más barata

*Media · PC y celular · Un jugador y sala · 1 semana · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** La mezcla AX y la reverb corren en el hilo del juego (`mix_worker=false`): cerca del 6 % de las muestras (AX 1,11, `CalcMixParam` 0,92, `ProcessVoice` 0,87, reverb 0,74 y más).
- **Arreglo:** Vectorizar la mezcla con SIMD128, o mandarla (con la reverb) al AudioWorklet. Riesgo medio si el juego lee las posiciones del stream.
- **Gana:** 0,3–0,8 ms en PC, más en el teléfono (estimado)
- **Se comprueba:** bancos `sonido-worklet` y `sonido`; perfil.
- **Dónde:** web/navegador/mkw.mjs:2620 (mix_worker); runtime (AX)

#### M10. Cambios de fibra y suspensiones JSPI: contarlos y recortarlos

*Media · PC y celular · Un jugador y sala · 1 día · Sospecha · Medir primero · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Cada cambio de hilo del juego (fibra) crea una promesa y un `queueMicrotask`, y cada suspensión deja correr las tareas pendientes dentro del cuadro. En el banco costó 0,7 µs, pero nadie contó cuántos hay por cuadro (estimado 100–400: 0,1–1 ms). `mkw_web_lockstep_pad` suspende una vez por cuadro aunque los botones ya hayan llegado.
- **Arreglo:** Contarlos (V4); un camino sincrónico en `pad` cuando los botones ya están; menos cambios de fibra donde se pueda.
- **Gana:** 0,1–1 ms (estimado)
- **Se comprueba:** contadores del medidor.
- **Dónde:** parches/runtime-web.diff:1552-1589; web/juego/pad_web.cpp:59-64,180

#### M11. Lo que no hay que hacer en el motor

*Media · PC y celular · Un jugador y sala · — · Dato de la plataforma*

- **Qué pasa:** Algunas ideas comunes romperían la sala o los fantasmas expertos de RR (grabados en una Wii de verdad): fast-math en el código traducido, SIMD relajado, `relaxed_madd` (el resultado depende del procesador: x86 contra ARM, y Liftoff contra TurboFan), memory64 (pierde las páginas de guarda y es más lento) y quitar la inversión de bytes (el juego lee los mismos bytes de varias formas).
- **Arreglo:** Dejarlas fuera. Dos formas seguras de lo parecido, con condiciones (versión 3): la multiplicación-suma del aparato solo si la prueba al arrancar demuestra que es fusionada en los dos compiladores de Chrome (H8), y guardar la RAM ya dada vuelta en vez de dejar de darla vuelta: cada acceso sigue viendo el orden de la Wii (H7).
- **Gana:** no romper la sala ni los fantasmas
- **Se comprueba:** bancos `paridad` y `fma` en x86 y en ARM (R6).
- **Dónde:** herramientas/compilar-web.py:159-165

### P · La página y el sitio (encontrado solo leyendo el código)

Lo que la página hace en cada refresco corre **antes** de que el juego despierte en ese refresco: se suma al cuadro, no corre aparte. Los bucles de `requestAnimationFrame` van al ritmo del monitor (con 144–240 Hz corren 2,4–4 veces por cuadro del juego). Y cada objeto que se crea y se tira se paga después en una limpieza de memoria (0,3–1 ms en PC, 1–5 ms en el teléfono). Son como cargas parásitas: chicas, pero en cada ciclo, y de vez en cuando provocan un pico.

#### P1. Un solo lector de mandos por cuadro, sin basura

*Urgente · PC y celular · Un jugador y sala · 2–3 días · Leído en el código*

- **Qué pasa:** `controles.mjs` hace `[...navigator.getGamepads()]` en cada refresco y arma claves, firmas con `join`, expresiones regulares, 4 objetos de puerto y un `map`; `asignacion-mando.mjs` recorre `Object.entries` y `RE_FUENTE.exec` por cada fuente. Encima corren dos copias del `mando.js` del sitio: una dentro del marco y otra arriba, que llama a `getBoundingClientRect` en cada cuadro con un mando conectado (obliga al sitio a recalcular su disposición). Total: 150–250 objetos y 30–50 expresiones regulares por mando y por refresco.
- **Arreglo:** Un módulo de entrada único: `getGamepads()` una vez por cuadro del juego; la asignación «compilada» al conectar (una tabla `[índice, umbral, bit]` en un `Int16Array`); objetos de puerto reusados y una firma numérica; el `mando.js` del marco alimentado por ese módulo (o dormido fuera de los menús de la página); y avisar a la copia de arriba con `{tipo:"fase"}` para que no mire el marco mientras se juega.
- **Gana:** 15–40 µs en PC y 60–150 µs en el teléfono por refresco (×2,4–4 con monitores rápidos), más la basura y el recálculo del sitio (0,1–2 ms)
- **Se comprueba:** bancos `controles`, `mando-sitio`, `asignacion` y `mandos-jugador`; limpiezas de memoria por minuto.
- **Dónde:** web/navegador/controles.mjs:233-381; web/navegador/asignacion-mando.mjs:117-128; juegos/audio/mando.js:201-212,636-639 (sitio)

#### P2. «Modo juego» del sitio mientras se juega

*Urgente · PC y celular · Un jugador y sala · 1–2 días · Leído en el código*

- **Qué pasa:** El marco es del mismo origen que Juegos: comparte proceso e hilo principal. Mientras se juega siguen corriendo `tickConsumo` cada 2 s (recorre todo `localStorage` dos veces con `JSON.parse`), los relojes de 30 s y de 5 s, el chat, las escuchas de Firebase y `pintaVestibulo`, que rehace el vestíbulo con `innerHTML` en cada mensaje `vr`, `fase` o `conexiones` aunque esté tapado. `.jg-modos` y la barra de abajo tienen `backdrop-filter: blur`, y solo se quita en el modo inmersivo, que está apagado por omisión.
- **Arreglo:** Con la fase que la página ya manda, el sitio entra en «modo juego»: pausa el consumo, los votos y las cuentas; marca el vestíbulo como «sucio» y lo pinta recién al volver a verse; sin desenfoques mientras haya un juego abierto; en `consumo.js`, un contador en vez de recorrer `localStorage`. Medir antes con `medir-sitio --sola`.
- **Gana:** se van los picos de 0,5–3 ms cada 2 s y de 1–5 ms por repintado (teléfono) dentro del cuadro
- **Se comprueba:** `medir-sitio` con y sin `--sola`; `mkw.test.cjs` del sitio.
- **Dónde:** juegos-main.js:816,1951,4315; consumo.js; colabtex/src/juegos/mkw.js:279-287,489-520,847-852; juegos.html:5241,5656 (sitio)

#### P3. Sin filtros CSS encima del lienzo del juego

*Alta · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** `.playlist-breve` usa `backdrop-filter: blur(6px)` en el descanso, con el juego moviéndose detrás; `.vc-plano` usa `blur(4px)`; hay dos `drop-shadow` sobre los números animados del contador DNF y animaciones infinitas que repintan borde y color. Cada filtro es una pasada extra de GPU por cuadro (1–3 ms en el teléfono), y cualquier capa encima del lienzo le impide ir directo a la pantalla.
- **Arreglo:** Fondo sólido semitransparente en vez de desenfoque (como ya se hizo con `#descarga`, §106); `text-shadow` o la sombra pintada una sola vez; animar solo `transform` y `opacity`. El aspecto lo aprueba el dueño.
- **Gana:** 0,3–1 ms en PC y 1–3 ms en el teléfono de GPU mientras se ven
- **Se comprueba:** tiempo de GPU con el descanso abierto.
- **Dónde:** web/navegador/index.html:65,284,300,426,674; web/navegador/dnf.mjs:53-56

#### P4. Un solo planificador por cuadro (reloj del monitor, esperas y rAF)

*Alta · PC y celular · Un jugador y sala · 2–3 días · Leído en el código*

- **Qué pasa:** `relojMonitor` copia y ordena las diferencias en cada refresco (`[...this.deltas].sort()`) y crea funciones nuevas; `esperaHasta` crea por llamada una promesa, varias funciones, un `filter`, un MessageChannel y un `setTimeout`. Además hay bucles rAF propios en `controles`, `dnf` (corre siempre, aunque no haya cuenta), `inicio` (no se detiene) y `alRefrescar`.
- **Arreglo:** Un planificador único: ventana circular en un `Float64Array` con la mediana cada 30 cuadros; funciones atadas una sola vez; esperas en un arreglo fijo con un solo `setTimeout` pendiente; cada módulo se suscribe solo mientras lo necesita. Cuidar el ritmo de §80 y §88, que dependen de esas esperas.
- **Gana:** 10–100 µs por refresco y unos 8 KB de basura menos por cuadro
- **Se comprueba:** `prueba-navegador` (punto «parejos en pantalla»), bancos `sonido-worklet` y `relevo`.
- **Dónde:** web/navegador/mkw.mjs:419-436,482-548; web/navegador/dnf.mjs:222-223; web/navegador/inicio.mjs:263-280

#### P5. Sonido: búferes reciclados y una sola llamada por entrega

*Media · PC y celular · Un jugador y sala · 1–2 días · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Unos 330 mensajes por segundo al AudioWorklet, cada uno con un búfer nuevo (`vista.slice()` + `postMessage` transferido), dos llamadas EM_JS por entrega, y en el worklet `Math.min(...this.ventana)` y un informe con `...this.c` cada 8 bloques: 3–5 ms por segundo en PC, 10–20 en el teléfono, y unos 380 KB por segundo de búferes nuevos.
- **Arreglo:** Un juego de búferes que el worklet devuelve con su informe (no se crea nada nuevo); una sola EM_JS por entrega; el informe cada 32 bloques y el mínimo llevado al día. Sin memoria compartida, porque el sitio no tiene COOP/COEP.
- **Gana:** menos basura y menos trabajo en el hilo del juego
- **Se comprueba:** bancos `sonido-worklet` (34) y `sonido` (14); `mkwMedirDemora()`.
- **Dónde:** web/navegador/sonido.mjs:202-215; web/navegador/sonido-worklet.js:202-213; parches/runtime-web.diff:648-652,790-856

#### P6. El estado de los menús, una vez por cuadro

*Media · PC y celular · Sala · horas · Leído en el código*

- **Qué pasa:** En la sala `menus.estado()` lo llaman `filtro` y `cerrojo`, y `paso` llama a `filtro` por cada puerto: varias lecturas de la memoria del juego, con objeto y arreglo nuevos, en cada refresco.
- **Arreglo:** Calcularlo una vez por cuadro, o al cambiar de pantalla (el juego ya lo avisa desde `paginas_nativo.cpp`), y pasar el resultado.
- **Gana:** decenas de µs y basura menos por refresco
- **Se comprueba:** banco `controles`.
- **Dónde:** web/navegador/mkw.mjs:748-755,1518-1527; web/navegador/menus.mjs:67-86

#### P7. Registro circular, pintado solo si se ve

*Media · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** `mkw.mjs` hace `console.log`, agrega a `todoElLog` sin tope, reescribe `textContent` y lee `scrollTop=scrollHeight` (recalcula la disposición); el medidor escribe una línea de unos 600 caracteres cada segundo; los `<li>` de `verificaciones.mjs` no tienen tope. Con DevTools abierto cada `console.log` cuesta 0,1–1 ms.
- **Arreglo:** Un registro circular de 5.000 líneas; pintar el cajón solo cuando está abierto; el medidor a la consola solo con `?medidor=1`. Revisar que ninguna prueba lea el cajón.
- **Gana:** memoria estable en sesiones largas y sin recálculo de disposición por línea
- **Se comprueba:** memoria de la pestaña después de 1 h de sala (V6).
- **Dónde:** web/navegador/mkw.mjs:204-219,2197-2280; parches/aurora-web.diff:774-786; web/navegador/verificaciones.mjs

#### P8. Relojes chicos que se suman

*Media · PC y celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** `leerNombresCpu` cada 500 ms; `vigilaCortina` cada 200 ms (en la sala nunca se apaga); la pastilla reescribe su texto cada 500 ms aunque no cambie; `graficos.mjs` lee `localStorage` y hace `JSON.parse` cada segundo; relojes de 250 ms a 1 s en `mkw.mjs` y `records.mjs`.
- **Arreglo:** Apagar cada uno cuando no hace falta y escribir solo si algo cambió; leer los gráficos una vez y escuchar el evento `storage`.
- **Gana:** menos despertares y menos basura
- **Se comprueba:** cantidad de temporizadores vivos durante la carrera (DevTools).
- **Dónde:** web/navegador/mkw.mjs:1540,1775,2002,2119,2374; web/navegador/interfaz.mjs:134-142; web/navegador/graficos.mjs:201; web/navegador/records.mjs:68

#### P9. La página del juego en su propio proceso (Document-Isolation-Policy)

*Investigar · PC y celular · Un jugador y sala · 1–2 semanas · Dato de la plataforma · Lo hace el dueño*

- **Qué pasa:** El marco comparte proceso e hilo con Juegos (Firebase, chat, el `mando.js` de arriba): cada tarea larga de uno congela al otro. Poner COOP/COEP en `juegos.html` rompería el inicio de sesión con ventana emergente de Firebase, y GitHub Pages no deja poner cabeceras.
- **Arreglo:** Servir la página del juego con la cabecera `Document-Isolation-Policy` (Chrome 137 en escritorio, 146 en Android) desde el Worker o Cloudflare Pages: queda en otro proceso, con su propio hilo, y con `SharedArrayBuffer` (abre la puerta a G9). Hay que pasar a `postMessage` todo acceso directo al padre (`mkwConectarRecords`, `mkwConectarNube`, `mando-sitio.mjs`, `privado.mjs`); si queda en otro dominio, su almacenamiento queda aparte. Primero P2 y medir: solo vale si el sitio todavía se mete en el cuadro.
- **Gana:** el sitio y el juego dejan de quitarse el hilo
- **Se comprueba:** tareas largas del sitio dentro del cuadro = 0; un banco con el marco aislado (y probar si un service worker basta para la cabecera).
- **Dónde:** colabtex/src/juegos/mkw.js:40,150-151,164-168 (sitio); web/navegador/mando-sitio.mjs; web/navegador/privado.mjs

#### P10. Todo el juego en un Worker con OffscreenCanvas

*Investigar · PC y celular · Un jugador y sala · 3–4 semanas · Dato de la plataforma*

- **Qué pasa:** Se puede sin memoria compartida (WebGPU y JSPI funcionan en workers), pero SDL3 asume que hay DOM, el C++ llama a 34 ganchos `Module.mkw*`, la página llama a 54 funciones exportadas, 8 módulos leen la memoria del juego directo y hay 36 usos de `localStorage` (que no existe en los workers).
- **Arreglo:** Solo si P2 y P9 no alcanzan. Gana estabilidad (nadie más usa el hilo del juego), no milisegundos; no arregla el proceso de GPU, la red ni la memoria.
- **Gana:** aislamiento total del hilo del juego
- **Se comprueba:** —
- **Dónde:** web/navegador/mkw.mjs (ganchos Module.mkw*); emsdk libhtml5.js:350-354; library_webgpu.js:1998

### E · Aparatos: celular, batería, calor y monitores

El teléfono del dueño (Oppo Find X9 Pro) es de gama alta: en régimen entra (12,3–12,6 ms), pero la 1.ª carrera cae a 20–37 fps y el 2.º informe dio unos 34 ms. Un teléfono de gama media sería 2–2,5 veces más lento (estimado 25–31 ms): hay que sumar casi toda la lista. El freno de CPU de Chrome exagera (×2,5 dio unas 8 veces más lento) y no frena al proceso de GPU, así que lo emulado no sirve como medida.

#### E1. Detectar el ahorro de energía de Chrome (todo a 30 Hz)

*Alta · PC y celular · Un jugador y sala · 1 día · Dato de la plataforma*

- **Qué pasa:** Con el Ahorro de energía de Chrome (con batería, o con batería bajo 20 %) todo se dibuja a 30 Hz y no hay forma de preguntarlo. Un portátil con batería juega a 30 sin decir por qué; en la sala, ese aparato queda relevado o atrasado.
- **Arreglo:** Medir el intervalo de rAF; si ronda 33 ms, avisar («Chrome está ahorrando batería: enchufa el equipo o apaga el Ahorro de energía») y, en la sala, seguir simulando a 60 (R2).
- **Gana:** nadie juega a 30 sin saberlo
- **Se comprueba:** un portátil con batería y el Ahorro de energía prendido.
- **Dónde:** web/navegador/mkw.mjs (relojMonitor)

#### E2. Calor en el teléfono

*Media · Celular · Un jugador y sala · 2–3 días · Sospecha · Medir primero*

- **Qué pasa:** En Android no hay Compute Pressure: el calentamiento se nota como CPU por cuadro que sube con los minutos. Un teléfono caliente baja su reloj y pasa de 60 a 40.
- **Arreglo:** Medirlo en una copa entera (V6); si sube, avisar al jugador y bajar el trabajo de la página (nunca karts ni efectos del juego). Lo de fondo es que el cuadro gaste menos: el resto de la lista.
- **Gana:** fps estables en copas largas
- **Se comprueba:** CPU por cuadro de cada minuto en una copa entera en el teléfono.
- **Dónde:** —

#### E3. Lo táctil y la inclinación, sin costo por cuadro

*Media · Celular · Un jugador y sala · horas · Leído en el código*

- **Qué pasa:** `controles.mjs` escucha `deviceorientation` siempre (aunque no se dirija inclinando) y llama a `getBoundingClientRect` en cada `pointermove`.
- **Arreglo:** Escuchar la orientación solo con la inclinación activa; guardar los rectángulos de los botones al dibujar el mando y al cambiar el tamaño.
- **Gana:** menos trabajo en cada toque
- **Se comprueba:** `prueba-tactil.mjs` (16 puntos).
- **Dónde:** web/navegador/controles.mjs:317,652-683

#### E4. Teléfonos de referencia reales

*Alta · Celular · Un jugador y sala · 1 día + aparatos · Dato de la plataforma · Lo hace el dueño · Medir primero*

- **Qué pasa:** Hoy solo se midió el Oppo del dueño. WebGPU en Android pide Chrome 121 y Android 12 o más con GPU Qualcomm o ARM; un teléfono de gama media nunca se midió.
- **Arreglo:** Elegir con el dueño 2 o 3 teléfonos de referencia (al menos uno de gama media) y medirlos con `adb reverse` o con el informe de rendimiento; una tabla de resultados por versión del juego.
- **Gana:** saber de verdad si se llega a 60
- **Se comprueba:** la tabla de fps por teléfono y por versión.
- **Dónde:** herramientas/prueba-celular.mjs

#### E5. PCs débiles y portátiles con dos tarjetas

*Media · PC · Un jugador y sala · 1 día · Sospecha · Medir primero*

- **Qué pasa:** Al cargar, la página pide 3 tarjetas con `requestAdapter`; pedir «alto rendimiento» despierta la tarjeta dedicada (y el ventilador). La medición de «PC débil» (CPU ×4) no frena al proceso de GPU, así que el lado de la GPU de un PC débil nunca se midió.
- **Arreglo:** Medir con Chrome atado a 2–4 núcleos y un perfil nuevo (V2); un solo `requestAdapter` y elegir `powerPreference` según lo medido.
- **Gana:** saber cómo le va al PC de un amigo
- **Se comprueba:** `medir-sitio` con afinidad.
- **Dónde:** web/navegador/mkw.mjs:268-272

#### E6. Monitores que no son de 60 Hz

*Media · PC · Un jugador y sala · 1–2 días · Medido*

- **Qué pasa:** Con 75, 144 o 165 Hz los 60 cuadros del juego no caen parejos sobre los refrescos: unos duran un refresco y otros dos (temblor). Las pruebas ya aceptan que ahí no hay «parejos en pantalla». Y los bucles rAF de la página corren 2,4–4 veces por cuadro del juego (P4).
- **Arreglo:** Con P4, que la página trabaje una vez por cuadro del juego y no por refresco. Decir en la ayuda que 60, 120, 180 y 240 Hz se ven parejos y 75, 144 o 165 Hz no del todo (se puede poner el monitor en 120).
- **Gana:** menos trabajo de la página y una explicación para el temblor
- **Se comprueba:** `prueba-navegador` con un monitor de 144 Hz.
- **Dónde:** web/navegador/mkw.mjs (relojMonitor)

#### R11. La sala con 3 conexiones: host en un jugador, host + repetidor Cloudflare, servidor Oracle

*Media · PC y celular · Sala · 1–2 semanas · Lo hace el dueño*

- **Qué pasa:** Pedido del dueño (2026-11-05). Hoy la sala tiene el árbitro en un jugador (R1, prendido por omisión desde e036653) y «🛰 Todo por Cloudflare» (§103, TURN, cobra por MB). Falta un árbitro que nunca se trabe ni se vaya: un servidor propio. El Durable Object de Cloudflare quedó descartado (~10.000 llamadas por carrera de 12: unos 45 min de sala llena al día gratis).
- **Arreglo:** Tres opciones en «✎ Cambiar» → Conexión del vestíbulo, con nombres cortos que dicen «host» o «servidor» y un textito al pasar el cursor (también con el foco y un toque en el celular): «Host: un jugador» (por omisión), «Host + repetidor Cloudflare» y «Servidor Oracle» (un programa Node con `wss://` en la VM ARM gratis de Oracle Cloud en Santiago hace de árbitro; si no contesta, la sala vuelve sola al host). `&conexion=host|cloudflare|oracle`; `docs/publicar-oracle.md` para el dueño.
- **Gana:** un árbitro estable que no es la PC de nadie, gratis y sin gastar llamadas del Worker
- **Se comprueba:** banco del servidor árbitro (uno local de mentira): huellas iguales, la vuelta al host y la traba de uno; `prueba-sincro --directa` en cada modo; `mkw.test.cjs` del sitio.
- **Dónde:** web/navegador/arbitro-servidor.mjs; herramientas/arbitro/; banco/pruebas/arbitro-servidor/; web/navegador/lockstep.mjs; colabtex/src/juegos/mkw.js

#### V8. Repartir por partes los ~10 ms del lado CPU del dibujo (la tarjeta ya está medida)

*Alta · PC y celular · Un jugador y sala · 1–2 días · Medir primero*

- **Qué pasa:** Plan combinado (2026-11-07). Las cifras de W10 (Codex: +30–80 %) cuelgan de un reparto ≈50/50 medido con el aparato de mentira, y en el teléfono probado frenaba la tarjeta (~34 ms por imagen con la interna ya en 640×528, §115). En la gama baja hay ~10 ms de dibujo fijo y esconder modelos y efectos solo ahorra 0,6–0,7 ms. **Casi todo ya medido:** la tarjeta no frena (§158, §164, §173: ≈3 ms en el Oppo); falta solo repartir los ~10 ms del lado CPU del dibujo (lo que necesita W27).
- **Arreglo:** Con `?perfilGpu=1` y `?lastreGpu`: el tiempo de cada pasada de la tarjeta (brillo, copias de imagen, sombras, partículas); repartir los ~10 ms fijos del dibujo de la CPU; confirmar el 50/50. Si el dueño puede, «🔬 Perfilar la tarjeta» en el teléfono real. Primeras mediciones (ideas de Codex, 2026-11-07): cuántas veces falla el atajo de aurora que reutiliza la última configuración de dibujo y cuánto cuesta rehacerla; y cuánto tarda aurora en volver a interpretar las listas de dibujo de la Wii (display lists) cada cuadro, capturando lo que entra a aurora. Techo de esto último: esconder todos los modelos (cuyas listas entonces no se leen) ahorró solo 0,6–0,7 ms, así que se espera ≤ 3 %. Meta para aprobar: bajar 3,3 ms un cuadro de 20 ms en la gama baja.
- **Gana:** decide qué ajustes gráficos rinden (G11–G14) y si W27 tiene dónde ganar
- **Se comprueba:** el informe por pasada en el teléfono simulado y en este PC
- **Dónde:** web/navegador/perfil-gpu.mjs; herramientas/medir-sitio.mjs; docs/plan-combinado.md

#### G11. Gráficos opcionales: brillo, efectos de pantalla y sombras simples

*PC y celular · Un jugador y sala · 1–2 semanas · Recompilar el .wasm · Medir primero*

- **Qué pasa:** El dueño (2026-11-07): «lo importante al final es el gameplay». Donde frena la tarjeta, el plan de CPU no ayuda. Opción del jugador, por omisión todo prendido; los 12 karts no se tocan. **Ya medido (2026-11-07, revisado):** en el Oppo la tarjeta trabaja ≈3 ms por imagen (§173, el tramo; los 34 ms de §115 eran espera) y en la 3080 Ti 0,16 ms (§158); lo que frena es la CPU (el juego y el lado CPU del dibujo), y esconder todos los modelos y efectos ahorra solo 0,6–0,7 ms de CPU en la gama baja. Por eso queda en prioridad baja: sirve solo a un aparato que de verdad frene por la tarjeta (un PC con gráficos integrados muy viejos).
- **Arreglo:** Interruptores en Avanzado → Gráficos: el brillo (bloom) No, los efectos de pantalla (las copias de imagen) No, sombras simples. Cada uno medido aparte en la tarjeta.
- **Gana:** menos pasadas de la tarjeta en los aparatos que frena la GPU (depende de V8)
- **Se comprueba:** cada interruptor medido en la tarjeta; la carrera igual (huellas iguales: no toca la lógica)
- **Dónde:** web/navegador/graficos.mjs; aurora

#### G12. Texturas bajísimas: reducidas al subirlas a la tarjeta

*PC y celular · Un jugador y sala · 3–5 días · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Plan combinado (2026-11-07). La tarjeta del teléfono lee menos memoria con texturas más chicas; nada del juego cambia ni se sube. **Ya medido (2026-11-07, revisado):** en el Oppo la tarjeta trabaja ≈3 ms por imagen (§173, el tramo; los 34 ms de §115 eran espera) y en la 3080 Ti 0,16 ms (§158); lo que frena es la CPU (el juego y el lado CPU del dibujo), y esconder todos los modelos y efectos ahorra solo 0,6–0,7 ms de CPU en la gama baja. Por eso queda en prioridad baja: sirve solo a un aparato que de verdad frene por la tarjeta (un PC con gráficos integrados muy viejos).
- **Arreglo:** Aurora achica cada textura (½ o ¼) antes de subirla, según el ajuste del jugador.
- **Gana:** menos ancho de banda de la tarjeta
- **Se comprueba:** la tarjeta por imagen antes y después; la foto igual salvo la nitidez
- **Dónde:** aurora texture_convert.cpp; web/navegador/graficos.mjs

#### G13. Menos partículas y el preajuste «Liviano»

*PC y celular · Un jugador y sala · 3–5 días · Medir primero*

- **Qué pasa:** Plan combinado (2026-11-07). Humo, chispas y polvo cuestan pasadas y relleno. **Ya medido (2026-11-07, revisado):** en el Oppo la tarjeta trabaja ≈3 ms por imagen (§173, el tramo; los 34 ms de §115 eran espera) y en la 3080 Ti 0,16 ms (§158); lo que frena es la CPU (el juego y el lado CPU del dibujo), y esconder todos los modelos y efectos ahorra solo 0,6–0,7 ms de CPU en la gama baja. Por eso queda en prioridad baja: sirve solo a un aparato que de verdad frene por la tarjeta (un PC con gráficos integrados muy viejos).
- **Arreglo:** Un ajuste de partículas reducidas y un preajuste que junta G11, G12 y la resolución de salida más baja, ofrecido al teléfono y al PC con gráficos integrados.
- **Gana:** un clic para el teléfono flojo
- **Se comprueba:** la tarjeta por imagen con el preajuste; la carrera igual
- **Dónde:** web/navegador/graficos.mjs

#### G14. Modelos low poly, simplificados en la página al cargar

*PC y celular · Un jugador y sala · 2–4 semanas · Recompilar el .wasm · Medir primero*

- **Qué pasa:** El dueño (2026-11-07) lo propuso. Mario Kart Wii ya tiene pocos polígonos para una tarjeta de hoy: probablemente no es lo que frena.
- **Arreglo:** Solo si V8 muestra que los vértices pesan: simplificar las mallas en la página al cargar cada pista (nada del juego a git).
- **Gana:** menos vértices (si pesaran)
- **Se comprueba:** la tarjeta por imagen; la colisión intacta (va aparte del dibujo)
- **Dónde:** aurora; docs/plan-combinado.md

#### G15. Elegir cómo se muestra la imagen en pleno juego: 30 parejas, 60 o con imagen intermedia

*Media · PC y celular · Un jugador y sala · 2–5 días · Medir primero*

- **Qué pasa:** El dueño (2026-11-08), a partir de lo que ofrece framepacer: cambiar el tope sin reiniciar. Hoy N8 Automático ya cambia solo en plena carrera, pero la imagen intermedia a 120/180 de Gráficos (§107) pide reiniciar el juego.
- **Arreglo:** Un selector en Gráficos y en el medidor: «30 parejas» (N8 modo 1), «60» (sin N8) y «con imagen intermedia» (modo 2, a la frecuencia del monitor si es múltiplo). Se aplica en el cuadro siguiente, sin reiniciar. **La lógica sigue siempre en 60** (justo para todos, también en la sala): solo cambia lo que se muestra. Revisar primero que el motor deje cambiar el modo de N8 y la interpolación de aurora en caliente.
- **Gana:** sin fps de lógica; el jugador elige suavidad o nitidez al momento
- **Se comprueba:** cambiar 20 veces en una carrera sin tirón ni cuadro negro; la huella de la sala igual con un jugador cambiando; los refrescos justos/repetidos de medir-enlinea en cada modo
- **Dónde:** web/navegador/n8.mjs; web/navegador/graficos.mjs; web/juego/n8_nativo.cpp; parches/aurora-n8.diff

#### G16. El 1 % más bajo casi igual a los fps a la vista: medirlo y vigilarlo

*Alta · PC y celular · Un jugador y sala · 1 semana (medir) + lo que salga · Medir primero*

- **Qué pasa:** El dueño (2026-11-08): «la idea es que los 1% lows sean casi iguales a los fps mostrados». Hoy se mide el p99 de la CPU por cuadro (`medir-sitio`), pero no el 1 % y el 0,1 % más bajos de las imágenes que de verdad salen a la pantalla, que es lo que se siente como tirón.
- **Arreglo:** Medir los intervalos entre imágenes mostradas (el anillo de 240 periodos de `relojMonitor`) y dar fps a la vista, **1 % bajo** y **0,1 % bajo** (como los programas de medir de PC): en el medidor con un gráfico en vivo del tiempo por imagen (una línea plana = suave, cada pico = un tirón, con su causa si se sabe: pipeline armado de golpe, recolector, disco, la red de la sala), en `medir-sitio`, `medir-enlinea` y la escalera. Después atacar lo que más baje el 1 %, sin tocar la lógica, que sigue siempre en 60. Con N8 o G15 se mide contra el tope elegido (30 parejas: el 1 % bajo debería ser 30).
- **Gana:** meta: 1 % bajo ≥ 95 % de los fps a la vista en este PC y en la gama baja simulada
- **Se comprueba:** la escalera con el 1 % y el 0,1 % bajos por aparato; 10 min de sala sin bajar de la meta
- **Dónde:** web/navegador/mkw.mjs (relojMonitor); herramientas/medir-sitio.mjs; herramientas/medir-enlinea.mjs; herramientas/tiempos-cuadro.mjs

#### G16b. La imagen intermedia de N8, pareja

*Media · PC y celular · Un jugador y sala · 1 día · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Lo que dejó G16 (§256): con «Imagen: con imagen intermedia» las dos imágenes de cada par salían en momentos distintos del cuadro y alternaban 13 y 20 ms; el 1 % bajo quedaba en 75 %.
- **Arreglo:** Anotar la toma cuando aurora pide la textura y que el compás no se quede en el borde de un refresco (un margen), así la imagen del medio sale a mitad del par.
- **Gana:** imágenes de 4 refrescos 50–64 → 92–97 %; a 60 el 1 % bajo 89 → 92 %
- **Se comprueba:** la sala idéntica (una pestaña a 30 parejas y otra con la intermedia), la gama baja sin empeorar, prueba-imagen
- **Dónde:** parches/aurora-n8.diff; web/navegador/mkw.mjs; bitácora §260

#### W30. Igual entre nosotros, no igual a la Wii: las cuentas del procesador con las del navegador

*Alta · PC y celular · Un jugador y sala · 1–2 días el piloto; semanas si gana · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** La traducción imita el procesador de la Wii al último bit: el redondeo de cada multiplicar-sumar (la FMA exacta), las tablas de fres/frsqrte y las banderas que calcula después de cada operación. Esa imitación es parte del impuesto del navegador (×2,5). La FMA exacta salió cara (−7,5 % en la gama baja, §184) y las banderas «techo» de M8 se descartaron solo porque cambiaban la carrera (§193). En la sala todos corren el mismo `.wasm`: basta con que las consolas den lo mismo entre ellas.
- **Arreglo:** Cambiar esas cuentas por las nativas de wasm (mul+add o la FMA de wasm, las divisiones de verdad, sin las banderas que nadie lee), deterministas en todos los aparatos. Piloto: solo la FMA y las banderas. Lo que se mide: la ganancia, que dos pestañas corran la misma carrera y cuánto se desvía el fantasma del experto (grabado en una Wii real) en una carrera entera (`prueba-fantasma-igual`). Si el fantasma se desvía: cuentas exactas solo en la Contrarreloj y las rápidas en la sala y las carreras. No cambia el manejo (diferencias de una millonésima); los fantasmas y récords de la página de antes del cambio habría que rehacerlos.
- **Gana:** +5–15 % de CPU (estimado), en la lógica y el dibujo
- **Se comprueba:** la gama baja simulada y este PC (≥ +8 % para seguir); la sala con huellas iguales; el desvío del fantasma del experto
- **Dónde:** parches/traductor-m8.diff; terceros/Wiicompiled-motor-fma; web/navegador/prueba-fantasma-igual.mjs; bitácora §184, §193

#### W31. Guardar la traducción de las listas de dibujo y los render bundles de WebGPU

*Media · PC y celular · Un jugador y sala · semanas · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** V8 (§249): el código de dibujo del juego es el 38 % del dibujo, aurora traduciendo de GX a WebGPU el 18 % y WebGPU y el pegamento el 9 %. El juego manda las mismas listas de dibujo en cada imagen y aurora las vuelve a traducir cada vez; techo medido de guardarlas: 0,6–0,7 ms por imagen en este PC.
- **Arreglo:** Guardar por lista (con la huella de la lista y del estado) el resultado ya traducido y solo repetirlo; grabar una vez la secuencia de órdenes de cada objeto quieto como render bundle de WebGPU y repetirla con una llamada. Después medir cuánto del recorrido de la escena es de objetos quietos (la pista, el público, los adornos) para ver si vale guardar también sus matrices.
- **Gana:** −20–25 % del dibujo: +5–10 % en la gama baja (estimado; ~1 ms por cuadro de lógica con N8)
- **Se comprueba:** la foto igual píxel a píxel, la tarjeta y la CPU por imagen en la gama baja y en este PC
- **Dónde:** aurora (lib/gfx); web/navegador/prueba-foto-igual.mjs; bitácora §249

#### W32. Evaluar: la IA de las CPU piensa cada 2 cuadros (la física sigue a 60)

*Media · PC y celular · Un jugador y sala · días (evaluar) · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Cada cuadro el juego decide por cada una de las 11 CPU la ruta, el giro, el derrape, el miniturbo, los objetos y el ajuste de velocidad, y después corre la física. La IA es una parte apreciable de la lógica (sin medir sola). El dueño (2026-11-09): «si la diferencia es imperceptible por el humano seria bueno considerarlo».
- **Arreglo:** Primero medir cuánto pesa la IA sola. Después un gancho que corre la decisión de la IA uno de cada dos cuadros y en el otro repite la anterior (un retenedor de orden cero a 30 Hz; la física de todos a 60; igual en todas las consolas). Se adopta solo si no se nota: los tiempos y puestos de las CPU por nivel iguales dentro del ruido (`medir-cpu-niveles`), sin choques ni salidas de pista de más, y un video lado a lado para el dueño. Nunca baja el nivel «Máximo» ni saca rivales.
- **Gana:** +10–20 % de lógica (estimado, depende de lo que pese la IA)
- **Se comprueba:** `medir-cpu-niveles` antes/después (tiempos y puestos por nivel), la sala con huellas iguales, el video para el dueño
- **Dónde:** web/juego/cpu_dificultad_nativo.cpp; herramientas/medir-cpu-niveles.mjs; bitácora §96

#### W26. La memoria durante horas: un conjunto acotado de pipelines

*Media · PC y celular · Un jugador y sala · 1–2 semanas · Medir primero*

- **Qué pasa:** Plan de Codex, punto 4 (2026-11-07). ~1,1 GB de crecimiento de la tarjeta en varias pistas (W8); `?soltarPipelines=2` lo deja plano pero luego hay que preparar los materiales sin saltarse dibujos.
- **Arreglo:** Conservar lo común, preparar la siguiente pista y soltar la anterior cuando sea seguro; junto con el sonido reciclado y las sesiones largas de V6. Prueba barata primero (idea de Codex, 2026-11-07): contar en 8 pistas cuántos textos WGSL distintos salen; si muchas configuraciones dan el mismo sombreador, compartir el módulo (los pipelines siguen aparte): menos memoria y menos compilaciones en las transiciones.
- **Gana:** sin fps, pero sin caídas ni cierres en copas largas
- **Se comprueba:** una hora de sala con la memoria plana y 0 dibujos saltados
- **Dónde:** web/navegador/lista-pipelines.mjs; aurora

#### W27. Reconstruir la preparación de cada imagen (escena persistente)

*Media · PC y celular · Un jugador y sala · meses (estimado) · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Plan de Codex, punto 2 (2026-11-07). Distinto de W22 (las llamadas finales a WebGPU, poco margen): aquí se quitaría trabajo de antes (recorridos, estados rehechos cada imagen).
- **Arreglo:** Solo si V8 encuentra un bloque grande y, tras W10, el dibujante es el cuello: materiales preparados al cargar, matrices solo al cambiar, la interfaz reutilizada.
- **Gana:** +12–29 % (hipótesis de Codex)
- **Se comprueba:** la foto igual píxel a píxel y la tarjeta por imagen
- **Dónde:** aurora; docs/plan-combinado.md

#### W28. Traducción de alto nivel de subsistemas enteros

*PC y celular · Un jugador y sala · muchos meses (estimado) · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Plan de Codex, punto 3 (2026-11-07). N14, W2, M8 y la FMA no ganaron; duplicar toda la lógica daría solo +33 %.
- **Arreglo:** En la repisa: solo con un piloto chico que gane claro, con los mismos resultados bit a bit.
- **Gana:** +5–15 % (hipótesis de Codex)
- **Se comprueba:** huellas 75/75 y el fantasma igual
- **Dónde:** docs/plan-combinado.md

#### W29. Piloto chico: la memoria del wasm de tamaño fijo

*Alta · Un jugador y sala · 1–2 días · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Idea de Codex aprobada por el dueño (2026-11-07). Hoy el programa arranca con 320 MB y puede crecer hasta 4 GB (`compilar-web.py`, `ALLOW_MEMORY_GROWTH`). En Android V8 revisa los límites de cada lectura a mano (W5: −6,8 % en la gama media simulada y −22,9 % en la baja); con memoria ampliable el tamaño puede cambiar y se relee, con tamaño fijo es una constante. Nunca se probó.
- **Arreglo:** Dos programas iguales salvo la memoria (`ALLOW_MEMORY_GROWTH=0`, `INITIAL_MEMORY` = lo que pide la pista más pesada con margen, p. ej. 1 GB) medidos en la gama baja simulada con `--js-flags=--wasm-enforce-bounds-checks` y en este PC, más la memoria máxima (`medir-memoria-pistas`).
- **Gana:** se aprueba con +5 % de cuadros de lógica en la gama baja simulada sin pasarse de memoria; se mata si da menos o si reservar la memoria de entrada no cabe en un teléfono de 4 GB
- **Se comprueba:** arranque 13/13, el fantasma igual; tramo fijo §163 en pares intercalados (2 pares deciden si ≥ +8 % o ≤ −2 %)
- **Dónde:** herramientas/compilar-web.py; bitácora §194 (W5)

### N · Lo profundo: lo que la primera versión no alcanzaba

Esta sección es nueva (versión 2). Sale de tu pregunta: «¿con estos cambios se llega a todos los objetivos?». La respuesta fue no, sobre todo fuera de los aparatos tope de gama (ver «¿Alcanza?»).

Aquí está lo que todavía puede mover la aguja: medir dónde juegan los demás (N1, N2), sacar el juego del hilo de la página y repartirlo en varios núcleos (N3, N4), lo que queda en el motor (N5–N7), mostrar 60 aunque se dibuje 30 (N8), entender la tarjeta del teléfono (N9), el plan C de la gama baja dentro de la página (N11; la app de Android, N10, quedó descartada: el dueño, 2026-10-29: el producto final corre siempre en la página, nunca como app descargable) y lo que no se puede (N12).

#### N1. Medir el impuesto del navegador: el mismo juego nativo contra el del navegador

*Urgente · PC · Un jugador y sala · 2–4 días · Sospecha · Medir primero · Recompilar el .wasm*

- **Qué pasa:** Todo el plan supone cuánto le cuesta al juego correr dentro del navegador, y eso nunca se midió. En WebAssembly cada lectura o escritura de la memoria de la Wii pasa por una tabla de páginas (en un PC nativo es un acceso directo que vigila el sistema operativo) y da vuelta los bytes sin una instrucción para eso; la multiplicación-suma exacta se emula con más de diez operaciones (M5); cada cambio de hilo del juego crea una promesa (M10); y la tarjeta de video se usa a través de otro proceso. Un programa nativo no paga nada de eso.
- **Arreglo:** WiiCompiled nació como programa nativo para PC (su CMake baja Dawn y SDL3 nativos). Compilarlo para Windows con el mismo juego, RR y los mismos ganchos de medida, y correr la misma carrera en el mismo PC contra el `.wasm`, en un solo hilo. La razón entre los dos es el impuesto del navegador. Si es chico (menos de ×1,3), todo se gana dentro del motor (N4–N7); si es grande (×1,5 o más), la gama baja solo se alcanza fuera del navegador (N10).
- **Gana:** saber con un número medido cuánto cuesta el navegador y cuánto de eso se puede recuperar dentro de wasm (el programa nativo es solo un instrumento de medida: nunca se entrega)
- **Se comprueba:** CPU por cuadro nativo contra wasm en la misma carrera (misma pista, mismas CPU, el mismo cuadro de partida).
- **Dónde:** terceros/Wiicompiled (CMake nativo); runtime/include/guest_flat_memory.h:39-44 (wasm sin vista plana); herramientas/medir-cpu.sh

#### N2. La escalera de aparatos: medir donde juegan los demás y fijar la meta de cada escalón

*Urgente · PC y celular · Un jugador y sala · 3–5 días · Dato de la plataforma · Medir primero · Lo hace el dueño*

- **Qué pasa:** Todo lo medido salió de los aparatos más rápidos de cada clase: el Ryzen 7 9800X3D (de los procesadores más rápidos para juegos; su caché de 96 MB le viene justo a un programa de 128 MB de código) y el Oppo Find X9 Pro (tope de gama de 2025). El juego usa un solo núcleo, y ese núcleo es 2–2,5 veces más lento en un PC típico, 3–4 veces en un teléfono de gama media y 5–9 veces en uno de gama baja (estimado por la velocidad de un núcleo). Sin medirlos, «60 fps» no tiene a quién referirse.
- **Arreglo:** Seis escalones: PC para juegos, PC típico (2018–2021), portátil de oficina, teléfono tope de gama, de gama media y de gama baja (E4, E5). Solo hay un aparato de verdad, este PC con varios Chrome (el Oppo ya no se mide, el dueño, 2026-10-31; lo que dio queda como referencia): los demás escalones se simulan con el aparato de mentira (H1), con el lastre de cada escalón sacado de la velocidad de un núcleo y de la tarjeta. En cada escalón, una carrera de 12 y una sala con el informe de rendimiento: CPU del juego, espera, tarjeta y cuadros de lógica (V1, V5). Si algún día alguien con otro aparato corre el informe (`mkwInformeRendimiento`), se suma como un punto real que corrige la simulación. Con la tabla, el dueño fija la meta de cada escalón: 60 de verdad, 60 a la vista con interpolación (N8) o fuera del navegador (N10).
- **Gana:** una meta que se puede cumplir y medir en cada escalón, y saber cuánto falta
- **Se comprueba:** la tabla de la escalera (medida en los dos aparatos y simulada en los demás) en `build/web/datos/escalera/` y en la bitácora, repetida al cerrar cada fase.
- **Dónde:** web/navegador/mkw.mjs (mkwInformeRendimiento); herramientas/medir-sitio.mjs --perfil

#### N3. El juego en su propio proceso y fuera del hilo de la página

*Urgente · PC y celular · Un jugador y sala · 2–4 semanas (1 de prueba) · Dato de la plataforma · Recompilar el .wasm · Volver a subir R2 · Lo hace el dueño*

- **Qué pasa:** El juego corre en el hilo principal de un marco del mismo origen que Juegos: comparte el hilo con el sitio (Firebase, la sala, el DOM y su limpieza de memoria). Lo que hace el sitio sale de los 16,7 ms del juego, y una tarea larga del juego congela la página. Es como alimentar el motor y la iluminación con el mismo circuito: cuando arranca uno, parpadea el otro.
- **Arreglo:** Servir la página del juego desde Cloudflare (el Worker de hoy o un dominio propio) con `Document-Isolation-Policy`: proceso propio y memoria compartida, sin tocar GitHub Pages ni el inicio de sesión de Firebase (P9). Y correr el juego entero en un Worker con `OffscreenCanvas` (P10): WebGPU funciona en Workers. La página queda para la interfaz, los mandos y la red, y le pasa los botones al juego por memoria compartida. Empieza con una semana de prueba (la puerta A): JSPI dentro del Worker, emdawnwebgpu con `OffscreenCanvas`, SDL3 sin DOM, el sonido por el AudioWorklet y el lockstep a través del Worker.
- **Gana:** el sitio deja de robarle tiempo al juego y el juego deja de congelar la página; es la base de N4
- **Se comprueba:** con la sala, el chat y Firebase activos, la CPU por cuadro del juego no cambia; el latido de otra pestaña no se atrasa al cargar (V2).
- **Dónde:** web/navegador/mkw.mjs, index.html, privado.mjs; parches/runtime-web.diff (JSPI)

#### N4. Varios núcleos: aurora, el sonido y el disco fuera del hilo del juego

*Urgente · PC y celular · Un jugador y sala · 3–5 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Un teléfono tiene 8 núcleos y el juego usa uno. En ese hilo van en fila la lógica, el dibujo del juego, aurora (decodificar el GX, convertir vértices, armar y mandar el trabajo de WebGPU), la mezcla del sonido (~6 %, M9) y el disco. Es el multiplicador grande que queda dentro del navegador.
- **Arreglo:** Con la memoria compartida de N3: el hilo del juego corre el código traducido y deja lo que va a la tarjeta en una cola, como la FIFO de la Wii; otro hilo la consume con aurora (G9, el «dual core» de Dolphin). La mezcla AX y la reverb, a su hilo o al AudioWorklet; el disco y la descompresión, a otro (D11). En el Worker el juego puede esperar con `Atomics.wait` en vez de suspenderse con JSPI. Cuidado: lo que la lógica le pregunta a la tarjeta (fin del dibujo, PeekZ) tiene que contestarse en el mismo cuadro en todos los aparatos.
- **Gana:** 10–25 % menos en el hilo del juego (estimado; se mide antes con V4)
- **Se comprueba:** huella ampliada igual (R5), `paridad` 22/0 y la CPU por cuadro del hilo del juego.
- **Dónde:** parches/aurora-web.diff (frame_worker_requested); aurora lib/gx/command_processor.cpp; runtime (AX)

#### N5. Traductor y memoria: lo que queda por sacar

*Urgente · PC y celular · Un jugador y sala · 3–6 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** El traductor ya es bueno: guarda los registros en variables dentro de cada función, copia en su lugar las funciones hoja chicas («inlined leaf») y llama directo, con los argumentos, a las que puede («statefree»). Lo que queda: en wasm cada acceso a la memoria de la Wii pasa por una tabla de páginas con revisiones (M1, M2), las llamadas que no son directas escriben y releen los registros vivos en el contexto, y se calculan banderas (XER, CR) que a veces nadie lee.
- **Arreglo:** Pasadas propias en `parches/` (M8, más a fondo): más funciones con llamada directa, más hojas en línea, banderas solo cuando alguien las lee y, en wasm, la RAM de la Wii en un lugar fijo de la memoria con una sola comparación para apartar la E/S y las páginas de código. Cada pasada se prende sola y se compara con `paridad`, la huella y los fantasmas.
- **Gana:** 1,1–1,3 veces más rápido el código traducido, que es ~60 % del cuadro (estimado)
- **Se comprueba:** `paridad` 22/0, fantasmas expertos de RR, huella ampliada y `medir-cpu.sh` por pasada.
- **Dónde:** generated/build_shards (ej. func_80199D64 = PSMTXConcat; «inlined leaf», `_statefree`); runtime/include/memory_access.h:380-410,687-692

#### N6. Reescribir en nativo lo que solo se ve: efectos, animación de los modelos y 2D

*Media · PC y celular · Un jugador y sala · 4–8 semanas · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Parte del cuadro no cambia la carrera: las partículas (`nw4r::ef`), la animación y las matrices de los modelos para dibujarlos (`nw4r::g3d`) y el 2D (`nw4r::lyt`). Hoy corren traducidas instrucción por instrucción, con la coma flotante de la Wii en software, aunque no necesitan los bits de la Wii.
- **Arreglo:** Medir cuánto pesa cada sistema (V4). Los más caros, reescritos en C++ propio con SIMD y enganchados en su dirección (entendidos con lo decompilado, nunca copiados). Antes, probar con el vigía y la huella que la lógica de verdad no los lee: en MKW hay objetos que chocan con huesos de su modelo, y lo que la lógica lee tiene que seguir saliendo igual en todos los aparatos.
- **Gana:** hasta 3 veces más rápido en lo reescrito; en el cuadro, según cuánto pese (estimado 5–15 %)
- **Se comprueba:** huella ampliada y fantasmas iguales; capturas iguales a simple vista; `medir-cpu.sh`.
- **Dónde:** generated/guest_symbol_table.cpp (nombres de nw4r::ef, nw4r::g3d y nw4r::lyt); ver M4

#### N7. Reescribir exacto lo caliente de la lógica

*Investigar · PC y celular · Un jugador y sala · 3–6 semanas · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Lo que sí decide la carrera (los choques con la pista KCL, la física del kart, la IA de las CPU) tiene que dar los mismos bits que la Wii: los fantasmas expertos de RR se grabaron en una Wii de verdad y la sala exige lo mismo en todos los aparatos.
- **Arreglo:** Como M4, pero con los sistemas más caros del perfil: una versión propia en C++ que repite el orden de las operaciones y los redondeos de la Wii, probada contra la traducida con millones de entradas al azar, bit a bit, y con los fantasmas. Solo si el perfil muestra que pesa.
- **Gana:** sin medir: depende del perfil
- **Se comprueba:** banco de entradas al azar bit a bit; fantasmas expertos de RR; huella ampliada.
- **Dónde:** generated/guest_symbol_table.cpp (KCL, Kart, AI)

#### N8. Simular a 60, dibujar a 30 y mostrar 60: la interpolación de aurora

*Alta · Celular · Un jugador y sala · 2–3 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** **Visto en el original (2026-10-30)**: el PR cerrado sin juntar `aurora-wiicompiled#6` («fix frame stutters», rama `frame-stutter-tracing`) hace la interpolación con hilos ayudantes (`MKW_INTERPOLATION_HELPERS`), traza cada imagen real e interpolada y evita que el juego y el GX queden atados a pocos núcleos; el compañero `Wiicompiled#363` trae un analizador de tirones. En wasm sin hilos la interpolación cae en el hilo del juego: se mide su costo antes de contar con ella. Retro Rewind ya se salta el dibujo de un cuadro cuando va atrasado (`rr_kamek_81806568`, §85.4): la lógica sigue a 60 y la pantalla muestra menos, a tirones. Y aurora ya sabe inventar cuadros intermedios: su interpolación vuelve a dibujar cada modelo 3D con la posición a mitad de camino (hoy para monitores de 120/180 Hz, §107).
- **Arreglo:** Usar la interpolación para rellenar el cuadro que el juego no dibujó: el teléfono que alcanza a simular 60 pero a dibujar 30 muestra 60 parejos, a cambio de un cuadro más de demora (16,7 ms) y del 2D (el marcador) a 30. En un jugador sirve desde ya; en la sala, después de R2 (allí saltarse el dibujo separaba la carrera). No ayuda si lo que frena es la tarjeta: la tarjeta sigue dibujando 60.
- **Gana:** 60 fps a la vista en aparatos que simulan a 60 pero no dibujan a 60 (la gama media, con el plan profundo)
- **Se comprueba:** cuadros mostrados contra cuadros de lógica por segundo (V5) y una grabación en el teléfono.
- **Dónde:** aurora lib/gx/frame_interpolation.hpp (MaxInterpolatedFrames = 3); web/navegador/graficos.mjs (frame_interpolation_fps)
- **Nota:** Versión 4 (2026-10-31): es la etapa 3 y va en el Worker del dibujo (W10), así la imagen intermedia sale del hilo de la carrera (sola, sin hilos, no ganó nada en la gama baja: §170). Es la meta de la gama baja (60 de carrera, 30 dibujados) y la reserva de la media. KartPad tiene una versión ya hecha con el modo de 30 fps del propio juego (−26 % de CPU por segundo, `docs/kartpad.md` §3); el camino de R2 es el seguro para la sala.

#### N9. La tarjeta del teléfono: de qué están hechos los 34 ms

*Alta · Celular · Un jugador y sala · 1–4 semanas · Medido · Medir primero · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** Hoy el Oppo se ve a 30 porque la tarjeta tarda ~34 ms por imagen (§115), y una escena de Wii es poca cosa para esa tarjeta: el costo está en cómo se le pide el trabajo (12 pasadas que cargan y guardan todo, vértices leídos desde storage buffers, profundidad de 32 bits, cientos de llamadas que pasan por el proceso de GPU de Chrome). Los arreglos de gráficos de la lista suman, según sus propias estimaciones, 5–15 ms: podría no alcanzar ni en el mejor teléfono. Y las tarjetas de gama media y baja son 3 a 10 veces más débiles.
- **Arreglo:** Primero medir por pasada con `timestamp-query` y separar la tarjeta del proceso de GPU (V1, G8). Si G2–G7 no la bajan de 14 ms con el lastre de tarjeta de la gama media (`?lastreGpu=6`): un camino de dibujo propio para teléfonos dentro de aurora (atributos de vértice para los formatos comunes, menos pasadas, profundidad de 24 bits donde dé igual, texturas ETC2, paquetes de dibujo ya validados —render bundles— para lo que no cambia entre cuadros). Es solo visual: no toca la simulación.
- **Gana:** saber si los teléfonos pueden llegar a 60 por el lado de la tarjeta; sin esto, ningún arreglo de CPU alcanza
- **Se comprueba:** `perfil-gpu.mjs` por pasada en este PC en el tramo fijo, sin lastre y con `?lastreGpu=6` (la gama media), antes y después.
- **Dónde:** web/navegador/perfil-gpu.mjs; aurora gfx/common.cpp, gx/shader.cpp; bitácora §115

#### N10. Plan C1: una app de Android con el juego nativo (descartado: el producto es siempre la página)

*Investigar · Celular · Un jugador y sala · 2–4 meses · Sospecha · Recompilar el .wasm · Lo hace el dueño · Medir primero*

- **Qué pasa:** Si el impuesto del navegador (N1) es grande, ningún arreglo dentro de Chrome lleva la gama baja a 60: ahí el juego necesita las instrucciones del procesador (dar vuelta los bytes, multiplicar-sumar exacto), todos sus núcleos y Vulkan directo, sin pasar por otro proceso.
- **Arreglo:** Compilar el mismo C++ para ARM64 y llevar aurora a Android (usa Dawn y SDL3, que ya andan ahí, sobre Vulkan), con una app chica que baja el juego desde R2 detrás del Worker, igual que la página, y entra a la misma sala (WebRTC con el mismo protocolo del lockstep). Los mismos bits que el `.wasm` (sin fast-math; FMA por hardware solo si se prueba exacta), comprobado con `paridad` y la huella. Se instala aparte (fuera de Play Store) y nunca se publica: es el ejecutable traducido.
- **Gana:** 1,5–2,5 veces el navegador en el mismo teléfono (estimado; N1 lo mide antes en el PC)
- **Se comprueba:** una sala con un PC (navegador) y un teléfono (app): la huella igual en 3 carreras.
- **Dónde:** terceros/Wiicompiled (build nativo); aurora (Dawn sobre Vulkan); web/navegador/lockstep.mjs (el protocolo)

#### N11. Plan C2: el teléfono débil ve la carrera en video desde un PC de la sala

*Alta · Celular · Sala · 3–5 semanas · Sospecha · Medir primero*

- **Qué pasa:** Un teléfono que no puede simular 60 cuadros por segundo no puede estar en el lockstep. Pero el juego ya sabe dibujar la vista de otro jugador: la pantalla partida (`?unaPantalla=0`).
- **Arreglo:** Un PC de la sala dibuja también la vista del jugador del teléfono y se la manda en video por WebRTC (con el codificador de video del PC); el teléfono solo muestra el video y manda sus botones. Anda a 60 en cualquier teléfono, pero suma la ida y vuelta de la red más 30–50 ms de codificar y decodificar, y el PC paga una vista más y 5–8 Mbit/s de subida por teléfono.
- **Gana:** cualquier teléfono en la sala, a cambio de más demora
- **Se comprueba:** demora del botón a la imagen medida con una cámara; CPU y subida del PC.
- **Dónde:** web/juego/semillas_nativo.cpp (una pantalla); web/navegador/malla.mjs

#### N12. Lo que no se puede, por física, y decirlo en la página

*Media · PC y celular · Un jugador y sala · 2–3 días · Dato de la plataforma*

- **Qué pasa:** Algunas cosas no las arregla ningún plan: (1) un aparato que no simula 60 cuadros por segundo ni sin dibujar no puede correr a la par en el lockstep (el árbitro solo evita que frene a los demás); (2) con datos móviles (saltos de 50–200 ms) el retraso de los botones tiene que crecer, y se siente; (3) la 1.ª visita siempre baja ~100 MB y compila 108 MB de código; (4) un teléfono con 3–4 GB de RAM puede cerrar la pestaña; (5) el calor: un teléfono baja su velocidad después de 10–20 minutos (E2).
- **Arreglo:** Decirlo en vez de esconderlo: el informe de rendimiento dice en qué escalón está el aparato y qué esperar; la sala avisa antes de largar si un aparato no llega a simular a 60 (en vez de sacarlo a mitad de carrera); el retraso de cada uno se ve (📶).
- **Gana:** nada de sorpresas a mitad de carrera
- **Se comprueba:** banco: la sala con un aparato lento de mentira avisa antes de largar.
- **Dónde:** web/navegador/conexiones.mjs; mkw.mjs (mkwInformeRendimiento); lockstep.mjs

#### N13. Abrir el impuesto: dónde se va el 70 % que no es la memoria, y el impuesto en la carrera

*Urgente · PC · Un jugador y sala · 3–5 días · Medido · Medir primero*

- **Qué pasa:** Lo agregó el resultado de N1 (bitácora §153): el juego en el navegador tarda **×2,2** lo del mismo juego nativo en este PC. De esa diferencia, la memoria de la Wii explica ~30 %, la multiplicación-suma ~0 y el resto, **~70 %, no se sabe qué es**. Arreglar la memoria a la perfección (H6, H7) deja el juego en ~×1,8: unas 1,2 veces más rápido, no 1,3–1,8 como suponía el plan. Y se midió en la escena del título, sin dibujar: en la carrera la física pesa más y el reparto puede cambiar. Es como saber que un tablero pierde el 55 % de la energía y haber encontrado solo un tercio de la pérdida: antes de cambiar cables hay que medir circuito por circuito.
- **Arreglo:** (1) Perfil función por función, nativo contra wasm, con los mismos cuadros: el nativo con el muestreador de Windows (o los contadores de V4) y el wasm con `node --cpu-prof`; la razón por función ordena las sospechas: el despacho de llamadas indirectas (M3), lo que el traductor genera (M6–M8, H11), las comprobaciones de wasm, la conversión de coma flotante y las promesas del cambio de hilo (M10).

(2) El nativo con trabas de wasm, de a una (sin vectorizar, llamadas indirectas por tabla, memoria revisada como en §153): cuánto sube cada una dice cuánto pesa.

(3) Repetir N1 en una carrera de 12 (Time Trial o con CPU, el mismo cuadro de partida), si el nativo llega a la carrera; si no, la escena más cargada a la que llegue.
- **Gana:** saber a qué ítems del motor (pasos 6, 7, 13 y 14) dedicarles los meses, en vez de suponerlo
- **Se comprueba:** una tabla en la bitácora con el 70 % repartido en partes con nombre (lo sin explicar, menos de 20 %), y la razón nativo/wasm en la carrera.
- **Dónde:** herramientas/medir-impuesto.mjs, compilar-nativo.py (§153); herramientas/medir-contadores.mjs (§152)

#### N14. La IA reescribe las funciones calientes, con un comprobador automático que exige el mismo resultado

*Urgente · PC y celular · Un jugador y sala · 2–4 semanas · Medido · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Lo pidió el dueño (2026-10-30), con alta prioridad. Reescribir el juego entero a mano (~29.600 funciones del juego y ~11.650 de Retro Rewind) no conviene: son años, y el tiempo está repartido (la función más pesada es ~2 % del cuadro y las 60 más pesadas ~37 %, perfil de N13, `n13-carrera-nat-resumen.json`). Pero las más pesadas sí: lo lento no es escribirlas (la IA lo hace rápido) sino **comprobar** que dan exactamente lo mismo, bit por bit; sin eso la sala se desincroniza y los fantasmas no coinciden.
- **Arreglo:** (1) **El comprobador primero**: un banco que graba, en una carrera real de 12 (el tramo fijo de §163 y la sala), lo que entra y sale de cada función candidata (registros, memoria que lee y escribe) y después corre la versión nueva con las mismas entradas y compara todo, bit por bit. Más `paridad`, la huella ampliada de la sala y los fantasmas.

(2) **Va después del traductor** (el paso anterior): se vuelve a perfilar y se reescribe solo lo que siga caliente, para no hacer a mano lo que el traductor ya arregla para todas.

(3) **Por tandas y en paralelo**: las 50, después 100, después 500 más pesadas, varias sesiones a la vez. Cada función entra solo si el comprobador dice idéntico **y** la medida dice más rápida (en la gama baja simulada y en este PC); si no, queda la traducida. Cada una con su bandera para volver a la traducida.

(4) Es código propio escrito para entender el juego (como manda la regla de decompilar uno mismo): vive en el runtime, nunca se publica fuera del `.wasm` privado.
- **Gana:** la parte del tiempo que el traductor no alcance a bajar, función por función y sin riesgo de desincronizar
- **Se comprueba:** el comprobador con 0 diferencias en cada función aceptada; la CPU por cuadro de la carrera (tramo fijo) más baja en la gama baja simulada y en este PC; `paridad`, la huella de la sala y los fantasmas iguales.
- **Dónde:** build/web/datos/impuesto-perfil/ (el perfil por función, §165–§166); banco paridad; lockstep (huella ampliada, §154)

#### N15. Subir WiiCompiled a la versión 0.9.3 antes de tocar el traductor

*Urgente · PC y celular · Un jugador y sala · 2–4 días · Leído en el código · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Revisado el 2026-10-30 (pedido del dueño): los PR abiertos de WiiCompiled no traen nada de rendimiento, pero `main` avanzó 47 commits desde el fijado (`bd219e3`, 2026-10-09) hasta la v0.9.3. La v0.9.0 (`ac99413`, 467 archivos) trae **GX en su propio hilo** (#325, el «dual core» de G9 y H4), **la tabla de regiones por dirección cambiada por un mapa de rangos** (#328, la memoria de H6), cambios en el generador de C++ (memoria plana, variables locales, despacho) y aurora como submódulo; `cc6abd4` (#358) reescribe la parte del traductor donde irían M8 y M1 (rangos de memoria, ABI inferida, GQR); y hay arreglos de dibujo (matrices GX, niebla, texgen, Sky Station) y de mods (punteros reubicados, overlays). Hacer el paso 6 sobre la base vieja sería trabajar dos veces y juntarlo después con conflictos.
- **Arreglo:** (1) En una copia aparte (`terceros/Wiicompiled-motor`, para no romper lo que mide el paso 5): el traductor y el runtime de la v0.9.3 (`0d5c402`) con **nuestra aurora ya portada** y un adaptador para las 10 funciones nuevas que piden (el principio y el fin de cada imagen del hilo de GX, vsync, la tasa del monitor, los eventos); nuestros parches (`parches/*.diff`) portados encima; lo que el original ya hace, no se repite. La aurora nueva del original es otra y queda en N15b (decidido 2026-10-30).

(2) Retraducir y compilar aparte (`build/web-motor`); `paridad`, `prueba-arranque`, `prueba-navegador`, la huella de la sala y `correr-todo` contra ese build.

(3) La línea base nueva contra la vieja, en la misma tanda: el tramo fijo en este PC y en la gama baja simulada, y la razón wasm/nativo.

(4) Ver si el GX en su hilo anda en wasm sin memoria compartida o deja una base para el paso 9; anotarlo en G9 y H4.

(5) Recién con todo verde, el cambio al clon principal, coordinado con la sesión que esté midiendo.

(6) El dueño, 2026-10-30: «usa todo lo que nos sirva de todas maneras y evalúalo». Cada pieza útil del original se adopta y se mide por separado, con su bandera para volver atrás: #325 GX en su hilo, #328 mapa de rangos, #358 traducción determinista, #360 ritmo del sonido (frente a nuestro AudioWorklet), los arreglos de dibujo (#376, #348, niebla, #303) y de mods (#321, #359, #336), y #351 `--headless`. También los PR cerrados sin juntar: aurora-wiicompiled#6 (interpolación con hilos ayudantes, afinidad y traza por imagen; sobre todo, cuánto cuesta interpolar en wasm sin hilos en la gama baja, ver N8) y Wiicompiled#363 (el analizador de tirones, frente a `medir-sitio`/`medir-enlinea`). Lo que no sirve para la página (Mac, Linux, Steam, NTSC, vsync…) se anota en una línea. Todo queda en una tabla en la bitácora: cambio, adoptado sí/no, cómo se comprobó y el efecto medido.
- **Gana:** el paso 6 sobre el código que el original sigue mejorando (sin conflictos al juntar), sus arreglos de dibujo y de mods, y una base para el GX en su hilo
- **Se comprueba:** todas las pruebas en verde con el build nuevo, la huella y los fantasmas iguales, y la línea base nueva medida contra la vieja (no peor).
- **Dónde:** terceros/Wiicompiled (origin/main, v0.9.3); parches/; herramientas/versiones.md

#### N15b. La aurora nueva del original en el navegador

*Alta · PC y celular · Un jugador y sala · 2–4 semanas · Leído en el código · Recompilar el .wasm · Medir primero*

- **Qué pasa:** Visto al hacer N15 (2026-10-30): la aurora de la v0.9.3 ya no es la nuestra con cambios, es otra (el submódulo aurora-wiicompiled, 667 commits: un hilo de dibujo `render_worker`, el armado y la presentación de cada imagen aparte, menús con RmlUi, y seis librerías nuevas: zlib-ng, libpng, freetype, zstd, RmlUi y fmt 12). Nuestro `aurora-web.diff` ya no se puede aplicar: `common.cpp` y `staging_map.hpp` desaparecieron. Portarla al navegador es rehacer buena parte de la fase 3 (§25–§54). Por eso N15 se partió: N15 sube el traductor y el runtime nuevos con nuestra aurora y un adaptador de 10 funciones, y esto queda como ítem aparte, junto al dibujo en su hilo (G9, H4).
- **Arreglo:** (1) Portar la aurora nueva a Emscripten y WebGPU del navegador, con sus seis librerías y nuestros cambios de la fase 3 rehechos encima (la subida sin mapeo, la espera de la toma, el precalentado con tope y su pausa, la semilla de pipelines, `perfil-gpu`).

(2) Evaluar ahí, con foto antes y después, sus arreglos de dibujo: #376 matrices, #348 texgen, la niebla y #303 Sky Station. Los que sean de una línea ya se traen a nuestra aurora en N15.

(3) Ver si su `render_worker` sirve para el dibujo en otro hilo del paso 9, sin memoria compartida o con ella (H5, P9).

(4) Medir contra nuestra aurora en la misma tanda: el tramo fijo en la gama baja simulada y en este PC, y la tarjeta en el tramo (§164). Se adopta solo si no es peor.
- **Gana:** seguir los arreglos de dibujo del original sin portarlos a mano, y una base para el dibujo en su propio hilo
- **Se comprueba:** todas las pruebas del navegador en verde, las fotos de las pistas iguales o mejores, y el tramo fijo no peor que con nuestra aurora.
- **Dónde:** terceros/Wiicompiled-motor (submódulo aurora-wiicompiled); parches/aurora-web.diff; bitácora §25–§54

### H · La gama media: el plan ambicioso (versión 3)

Esta sección es nueva (versión 3). Sale de tu pedido: que la gama media también llegue a 60, atacando los dos cuellos de botella (el procesador y la tarjeta de video) y el «un solo núcleo».

Tres ideas la ordenan. (1) **Un presupuesto por pieza**: cada hilo y la tarjeta tienen una meta en ms, con margen, medida en este PC en el tramo fijo y con el aparato de mentira (H1, H2). (2) **La carrera en un núcleo, todo lo demás en otros**: la Wii tenía un solo procesador y la carrera sigue en uno, pero ese núcleo hace solo la carrera y 3–4 veces más rápido (H4–H11); la CPU y la tarjeta trabajan en paralelo, no en serie (H3). (3) **La tarjeta del teléfono a 2 ms**: los 34 ms de hoy son casi todo desperdicio (H12, H13).

Y con lo que hay para probar (este PC con varios Chrome, y Chrome con la emulación de teléfono; el Oppo ya no se mide, el dueño, 2026-10-31), la gama media y la baja se simulan con un «aparato de mentira» calibrado (H1), como una carga ficticia en un banco de pruebas.

#### H1. El aparato de mentira: la gama media y la baja simuladas en el PC

*Urgente · PC y celular · Un jugador y sala · 1–2 semanas · Dato de la plataforma · Medir primero*

- **Qué pasa:** No se puede probar con varios aparatos: lo máximo es este PC con varios Chrome y el Oppo. Una meta de gama media sin un aparato de gama media no se puede comprobar, y el PC y el Oppo son de lo más rápido que existe: lo que en ellos entra holgado puede no entrar en un teléfono de gama media.
- **Arreglo:** Un freno calibrado, como la carga ficticia con que se prueba una fuente de poder:

- **Lastre de CPU** (`?lastre=3.5`): el hilo del juego mide su trabajo de cada cuadro (t) y espera ocupado (K−1)·t más, así trabaja como un núcleo K veces más lento; los hilos de ayuda con su propio K (`?lastreAyuda=3`), porque en la gama media van a núcleos chicos.
- **Ladrón de caché**: un Worker que recorre 64 MB sin parar, para que el juego no viva en la caché grande (el 9800X3D tiene 96 MB y un teléfono medio, 2–4 MB) y pelee la memoria como en un aparato chico.
- **Lastre de tarjeta** (`?lastreGpu=6`): cada pasada se repite K veces en una imagen aparte, así la tarjeta trabaja como una K veces más débil.
- **Pocos núcleos**: la bolsa de hilos con 2 y los demás núcleos ocupados.
- **El Oppo por USB** (`chrome://inspect`): Playwright lo maneja y lee el informe, igual que en el PC.
- **Una tarjeta débil de verdad**, si está activa: la integrada del Ryzen (2 CU, del orden de la de un teléfono medio), pedida con `powerPreference: 'low-power'`.

Se calibra: con K = 1 no cambia nada, y con K = 2 y 4 el cuadro crece 2 y 4 veces. Y como la simulación no copia todo (cachés, memoria, calor), la meta lleva margen: 12 ms y no 16,7, como un componente que se usa al 70 % de lo nominal (H2).
- **Gana:** poder decir «la gama media llega» con un número medido, sin comprar aparatos
- **Se comprueba:** banco `lastre`: con K = 1, 2 y 4 el cuadro del juego crece 1, 2 y 4 veces (±10 %); la misma carrera en el tramo fijo (§163) con `&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6` y sin lastre.
- **Dónde:** web/navegador/mkw.mjs (mkwInformeRendimiento); web/navegador/perfil-gpu.mjs; herramientas/medir-sitio.mjs --perfil

#### H2. El presupuesto de la gama media: una meta en ms para cada pieza

*Urgente · PC y celular · Un jugador y sala · 1 día, y revisarlo al cerrar cada fase · Dato de la plataforma · Medir primero · Lo hace el dueño*

- **Qué pasa:** «60 fps en la gama media» no dice qué pieza tiene que bajar ni cuánto. Hoy el informe da un número para el juego y otro para la tarjeta, y cada uno contiene al otro (§115.5).
- **Arreglo:** Una tabla de presupuesto, como la de potencia de un diseño (ver «¿Alcanza?»): cada hilo y la tarjeta con su meta (medida en este PC en el tramo fijo; la referencia de partida es lo que dio el Oppo el 2026-10-30), sacada de cuánto más lento es un teléfono medio (CPU ×3,5, tarjeta ×5–8) y de la meta con margen de 12 ms. Hilo del juego ≤ 3,3 ms; hilo de dibujo ≤ 3,3; sonido y disco ≤ 1; ayudantes ≤ 2 repartidos; página ≤ 1; tarjeta ≤ 2. El informe de rendimiento muestra cada pieza contra su meta, y cada fase cierra midiéndolo.
- **Gana:** saber en todo momento cuánto falta y en qué pieza
- **Se comprueba:** `mkwInformeRendimiento` con la parte `presupuesto` (cada pieza en verde o rojo) en este PC, en el tramo fijo con y sin el lastre (H1).
- **Dónde:** web/navegador/mkw.mjs (mkwInformeRendimiento); web/navegador/graficos.mjs (queFrena)

#### H3. La CPU y la tarjeta en paralelo, no en serie

*Urgente · PC y celular · Un jugador y sala · 1–2 semanas · Medido · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** Hoy el juego espera a la tarjeta dentro de su propio cuadro: no empieza el siguiente con el anterior sin terminar (§115.1, §115.5). Así los tiempos se suman: CPU 12 ms + tarjeta 12 ms = 24 ms (40 fps), aunque cada uno por separado entraría en 16,7. Es como dos máquinas en serie sin depósito entre ellas: cada una espera a la otra.
- **Arreglo:** Dos cuadros en vuelo: mientras la tarjeta dibuja el cuadro n, el juego calcula el n+1 (aurora arma lo del n+1 en otro juego de búferes, y presentar solo frena si ya hay dos pendientes). El cuadro dura lo que la más lenta de las dos, no la suma. Costo: hasta un cuadro más de demora entre el botón y la imagen (16,7 ms), el mismo que trae la interpolación (N8); se mide y, si se nota, queda un modo de un cuadro en vuelo. No toca la simulación.
- **Gana:** con la CPU y la tarjeta cerca del límite, de 30–40 a 60 fps: el cuadro pasa de la suma de las dos a la mayor
- **Se comprueba:** con el lastre de tarjeta (H1) que la iguale a la CPU, los fps no caen a la mitad; la demora del botón a la imagen con `mkwMedirDemora` y con una cámara.
- **Dónde:** parches/aurora-web.diff (la presentación y la espera de tomar el lienzo, §54); web/navegador/mkw.mjs (mkwEsperaToma, mkwEsperaAtrasada)

#### H4. La carrera en un núcleo, todo lo demás en otros: el mapa de hilos

*Urgente · PC y celular · Un jugador y sala · 4–8 semanas (con N3 y N4) · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** **¿Se puede usar más de un núcleo? Sí, pero no para la carrera.** La Wii tenía un solo procesador: la carrera es una sola fila de decisiones y cada una depende de la anterior. Repartirla entre núcleos cambiaría el orden de las cuentas: las consolas de la sala dejarían de dar lo mismo y los fantasmas de RR se separarían.

Pero el hilo de hoy hace mucho más que la carrera: también hace lo que en la Wii hacían otros chips (el procesador gráfico que leía la FIFO, el DSP del sonido, el lector del disco) y además la página. Eso sí se puede repartir.
- **Arreglo:** Repartir como estaba repartida la Wii, una pieza por núcleo:

- **Juego**: la carrera y el recorrido del dibujo, que deja los comandos GX en una cola. Es la FIFO de la Wii, que existía justo para que el procesador no esperara al gráfico.
- **Dibujo**: aurora lee la cola, convierte y habla con WebGPU (G9).
- **Sonido**: la mezcla AX en el AudioWorklet o en su hilo (M9).
- **Disco**: lecturas y descompresión (D11).
- **Ayudantes**: lo que solo se ve, en paralelo (H10).
- **La página**, en el hilo principal: interfaz, mandos y red.

Regla de oro: lo que corre aparte nunca escribe algo que la carrera lea; si la lógica le pregunta algo a la tarjeta (el fin del dibujo, PeekZ), se contesta igual en todos los aparatos. Pensado para la gama media, que tiene 4 núcleos grandes y 4 chicos (algunos, solo 2 grandes): el juego en uno grande, el dibujo en otro, y el sonido y el disco caben en los chicos. Es N4 llevado hasta el final.
- **Gana:** el hilo del juego queda con la carrera y el recorrido del dibujo: de ~9 a ~5–6 ms en el PC antes de acelerar el motor (estimado con el reparto de §85)
- **Se comprueba:** huella ampliada igual (R5) y `paridad` 22/0; la CPU de cada hilo en el informe; con `?hilos=1` (todo en uno) da los mismos bits.
- **Dónde:** aurora lib/gx/command_processor.cpp; parches/aurora-web.diff; runtime (AX); web/navegador/sonido-worklet.js

#### H5. Varios núcleos aunque el teléfono no dé memoria compartida

*Urgente · Celular · Un jugador y sala · medio día de prueba + 2–3 semanas · Dato de la plataforma · Medir primero · Lo hace el dueño*

- **Qué pasa:** Los hilos con memoria compartida exigen una página aislada. En el escritorio, Document-Isolation-Policy la da desde Chrome 137 sin tocar el sitio (N3). En Android no encontré confirmación de que esté (se discutió llevarla a todos los Android salvo los de menos de 2 GB). Sin eso, el plan de hilos se cae justo en el teléfono, que es donde más falta hace.
- **Arreglo:** (1) Saber si Chrome de Android da memoria compartida con Document-Isolation-Policy: de la documentación, y con una página del banco servida con la cabecera en Chrome del PC con la emulación de teléfono: ¿`crossOriginIsolated` y un `SharedArrayBuffer`? Es medio día.

(2) Si no está: la página del juego como página propia (no como marco), servida desde Cloudflare con COOP y COEP, que habla con la sala por la red en vez de por el marco. Es más trabajo y lo decides tú.

(3) Plan B, sin memoria compartida: los hilos se pasan cajas en vez de compartir la mesa. El juego llena un búfer de comandos por cuadro y lo entrega al hilo de dibujo sin copiarlo (`postMessage` con transferencia), con las texturas y los vértices nuevos adentro; el sonido ya viaja así (§88). Gana menos que con memoria compartida, pero anda en cualquier Chrome.
- **Gana:** que los hilos lleguen al teléfono, que es donde hacen falta
- **Se comprueba:** banco `aislamiento` en Chrome del PC (también con la emulación de teléfono); una carrera con el plan B en este PC, con la huella igual.
- **Dónde:** web/navegador/sonido.mjs y sonido-worklet.js (el sonido por mensajes, §88); herramientas/worker-local.mjs (las cabeceras)

#### H6. La memoria de la Wii en un lugar fijo: una cuenta en vez de una tabla

*Urgente · PC y celular · Un jugador y sala · 2–3 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** **WiiCompiled v0.9.0 cambió la tabla de regiones por dirección por un mapa de rangos (#328)**: medir sobre esa base (N15). En wasm, antes de cada lectura de la memoria de la Wii se desplaza la dirección, se lee una tabla de páginas, se revisa que no sea cero y se suma un desplazamiento; cada escritura además revisa el borde de la página y si es código (`memory_access.h`). Son unas 8 operaciones antes del dato, en cada acceso, y en el código traducido cerca de una de cada tres instrucciones lee o escribe la memoria. Un programa nativo hace una sola.
- **Arreglo:** Poner la RAM de la Wii (MEM1 de 24 MB y MEM2 de 64 MB) en un lugar fijo de la memoria de wasm, en el mismo orden que en la Wii. La dirección física es la de la Wii con los 3 bits de arriba borrados (así lo hace la Wii misma con sus dos vistas, con y sin caché). Una lectura queda en: borrar 3 bits, sumar una base fija y leer. Lo que no es RAM (los registros de E/S) sigue por el camino de hoy; la escritura en páginas de código se revisa con un mapa de un bit por página de 4 KB. El hueco de 232 MB entre MEM1 y MEM2 se reserva pero el sistema no lo llena hasta tocarlo (hay que medir la memoria en el Oppo). Es la versión a fondo de la «RAM fija» de N5.
- **Gana:** cada acceso 2–3 veces más barato; con H7, a lo sumo ~1,2 veces el juego entero: N1 midió que la memoria es ~30 % del impuesto de ×2,2
- **Se comprueba:** `paridad` 22/0, huella ampliada y fantasmas; un banco de direcciones al azar contra el camino de hoy; la memoria del proceso en Chrome del PC (`medir-memoria.mjs`).
- **Dónde:** runtime/include/memory_access.h:356-410 (TryReadGuestScalar, TryWriteGuestScalar); guest_flat_memory.h:39-44; generated/functions (FlatWriteRam32, PPC_PsqLGqrInline)

#### H7. La RAM de la Wii guardada ya dada vuelta: sin invertir bytes en cada lectura

*Urgente · PC y celular · Un jugador y sala · 3–5 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** La Wii guarda los números con el byte grande primero; el PC y el teléfono, al revés. Hoy cada lectura de 32 bits (entero o coma flotante) se da vuelta con unas 6 operaciones, porque wasm no tiene la instrucción. M11 advierte, con razón, que no se puede simplemente dejar de darlos vuelta: el juego lee los mismos bytes de a 1, 2 y 4.
- **Arreglo:** El truco de los emuladores de Nintendo 64: guardar la RAM ya dada vuelta, de a palabras de 4 bytes. Cada acceso sigue viendo los bytes en el orden de la Wii, pero más barato: una lectura de 4 bytes sale derecha, sin invertir nada; una de 1 byte lee en la dirección con los 2 bits de abajo invertidos (una operación); una de 2 bytes, con un bit; y una de 8 bytes intercambia sus dos mitades (una operación).

Lo caro: todo lo que lee la RAM de la Wii desde fuera del código traducido (aurora con texturas, vértices y listas de dibujo; el disco al copiar archivos; el sonido; los ganchos de la página como `mkwEstado` o los letreros) tiene que leer o copiar dando vuelta, con una mezcla SIMD por cada 16 bytes. Y las lecturas desalineadas van por un camino lento. Se hace detrás de una bandera y se comprueba pieza por pieza.
- **Gana:** estimado 1,15–1,3 veces más, sobre H6; las dos juntas dejan el acceso a memoria 3–4 veces más barato
- **Se comprueba:** `paridad`, huella y fantasmas; capturas iguales píxel a píxel; `prueba-navegador`, `prueba-sala` y todos los bancos que leen la memoria del juego.
- **Dónde:** runtime/include/memory_access.h (MaybeByteSwap); aurora (lecturas de texturas y vértices); web/navegador (mkwEstado, letreros.mjs, directo.mjs)

#### H8. La multiplicación-suma del aparato, comprobada al arrancar

*Investigar · PC y celular · Un jugador y sala · 1 semana · Leído en el código · Recompilar el .wasm · Volver a subir R2*

- **Qué pasa:** wasm no tiene multiplicación-suma exacta: el runtime la arma con unas 10 operaciones en simple precisión y unas 25 en doble (TwoSum y redondeo a impar, `ppc_isa_wasm_neon.h`), y la Wii la usa en casi toda la física. Pero todos los teléfonos (ARM64) y los PC desde 2013 tienen la instrucción exacta, y Chrome la usa para `relaxed_madd` de SIMD relajado.
- **Arreglo:** Al arrancar, probar con un juego de casos si `relaxed_madd` del aparato es fusionada (bit a bit igual que la exacta), en los dos compiladores de Chrome (la prueba se repite hasta que V8 la optimiza). Si lo es, usarla: una multiplicación-suma fusionada da por definición los mismos bits que la exacta. Si no (un PC viejo), el camino de hoy. Las dos dan lo mismo, así que la sala puede mezclarlas. Cambia la regla de M11 («nada de SIMD relajado») solo para esta operación y solo con la prueba aprobada.
- **Gana:** estimado 3–8 % del código traducido; N1 midió ~0 en el título: se hace solo si N13 la ve pesar en la carrera
- **Se comprueba:** banco `fma` (40 millones de casos) con las dos versiones, en Node y en Chrome del PC, también con Chrome forzado a cada compilador (`--js-flags=--liftoff-only` y `--no-liftoff`); `paridad`; huella.
- **Dónde:** runtime/include/isa/ppc_isa_wasm_neon.h:22-130 (MkwWasmFmaf, MkwWasmFmaRaw); runtime/include/isa/ppc_isa_float.h:606-630

#### H9. Las cuentas de a dos de la Wii y las matrices en SIMD de verdad

*Media · PC y celular · Un jugador y sala · 2–3 semanas · Leído en el código · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** La Wii hace muchas cuentas de a dos números a la vez («paired singles»): una matriz se multiplica con instrucciones de dos carriles (`PSMTXConcat` = `func_80199D64`). El runtime las emula con vectores de 2 que el compilador decide si hace en SIMD o de a uno, y cada carga de un par pasa por la tabla de páginas y da vuelta los bytes de a un número.
- **Arreglo:** Cargar el par con una sola lectura de 8 bytes y darlo vuelta con una sola mezcla SIMD (`i8x16.shuffle`), y hacer las cuentas de pares en `f32x4` directo. Y M4 a fondo: las funciones de matrices y vectores de la biblioteca (PSMTX*, PSVEC*) en C++ propio, exactas y con 4 carriles.
- **Gana:** estimado 2–3 veces en las matrices; en el cuadro, según cuánto pesen (lo dice V4)
- **Se comprueba:** banco de entradas al azar, bit a bit, contra la traducida; `paridad`; huella.
- **Dónde:** generated/functions/func_80199D64.cpp (PPC_PsqLGqrInline, PPC_PsMadds1Inline); runtime/include/isa/ppc_isa_float.h

#### H10. Lo que solo se ve, en paralelo y fuera del hilo del juego

*Alta · PC y celular · Un jugador y sala · 4–6 semanas (con N6) · Sospecha · Decompilar · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** N6 reescribe en nativo las partículas, la animación de los modelos y el 2D, pero los deja en el hilo del juego. En la gama media cada milisegundo de ese hilo vale por tres y medio.
- **Arreglo:** Los sistemas que solo se ven pasan a los hilos ayudantes, con una foto del estado: al terminar la lógica del cuadro n se copia lo que necesitan (dónde está cada emisor, las matrices de los huesos que la lógica ya calculó, el estado del 2D), y mientras el juego calcula el n+1, los ayudantes preparan lo que se dibuja del n (partículas, matrices de dibujo, vértices del 2D), repartidos de a modelo o de a emisor entre 2–4 hilos. Lo que la lógica sí lee (los huesos que chocan) se queda en el hilo del juego: lo prueba el vigía.
- **Gana:** estimado 15–30 % del hilo del juego, según lo que mida V4
- **Se comprueba:** huella ampliada y fantasmas iguales; capturas iguales a simple vista; la CPU de cada hilo.
- **Dónde:** generated/guest_symbol_table.cpp (nw4r::ef, nw4r::g3d, nw4r::lyt); MKW_VIGIA (el vigía de escrituras)

#### H11. Código caliente junto y chico: los teléfonos tienen cachés chicas

*Urgente · Celular · Un jugador y sala · 1–2 semanas · Sospecha · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** El programa son 108 MB de código. El 9800X3D tiene 96 MB de caché; un teléfono de gama media, 2–4 MB. Si en cada cuadro el juego salta por todo el programa, el teléfono medio va a buscar código a la memoria lenta y queda más atrás de lo que dice la velocidad de su núcleo. No se puede medir en un teléfono medio, pero sí con el ladrón de caché (H1).
- **Arreglo:** Contar qué funciones corren en una carrera (el contador de V4); compilar lo caliente con `-O3` y junto, y lo frío con `-Os` (más chico: también baja la descarga y la compilación de la 1.ª visita). Comparar con el ladrón de caché prendido y apagado: si el juego empeora mucho con el ladrón, esto pesa. **Problema abierto que se le suma (de C8, descartado, §157):** en el teléfono la 1.ª carrera va unos 21 s a 20–37 fps mientras V8 pasa el código caliente a su compilador optimizador (TurboFan) jugando; V8 solo guarda en su caché lo ya optimizado, así que compilar antes en el vestíbulo no lo arregla, y U1 (los pipelines) tampoco. Lo caliente más chico y junto acorta ese calentamiento; en la gama baja (ya es meta) pesa más. En este PC no se ve (60 fps desde el primer segundo, también con 2 núcleos): se mide en el Oppo (el lastre de H1 no frena los hilos con que V8 compila; `medir-sitio --nucleos` sí, en parte). Y en un PC de 2 núcleos (§158) la misma optimización al largar la 1.ª carrera traba a todo Chrome ~300 ms (con `--liftoff-only` desaparece): menos código caliente que optimizar también cierra el criterio de carga del paso 4.
- **Gana:** sin medir: protege a la gama media de un costo que el PC no muestra, y achica el `.wasm`
- **Se comprueba:** `medir-cpu.sh` con y sin el ladrón de caché; el tamaño del `.wasm`.
- **Dónde:** herramientas/compilar-web.py (banderas de compilación por fragmento); generated/build_shards

#### H12. La pista quieta en la tarjeta: no convertir ni subir otra vez lo que no cambia

*Urgente · Celular · Un jugador y sala · 2–4 semanas · Medido · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** En cada cuadro aurora convierte y sube a la tarjeta 1,1–2,5 MB (vértices, índices y uniformes, §115.5), pista incluida, aunque la pista no cambia en toda la carrera. Gasta CPU del hilo de dibujo, el ancho de banda de la memoria (en el teléfono la comparten el procesador y la tarjeta) y tiempo del proceso de GPU de Chrome.
- **Arreglo:** Una caché de geometría en aurora: cada lista de dibujo de la Wii y sus vértices, reconocidos por su dirección y una huella del contenido, se convierten y suben una vez y quedan en la tarjeta; por cuadro solo cambian las matrices. Se descarta si esa memoria cambia (el mapa de escrituras de H6). Va junto con G3.
- **Gana:** estimado: la subida por cuadro de 1,1–2,5 MB a 0,2–0,5 MB, y buena parte de la conversión de aurora
- **Se comprueba:** KB subidos por cuadro (el contador de §115); capturas iguales; la CPU del hilo de dibujo.
- **Dónde:** aurora gfx/common.cpp (staging); aurora lib/gx/command_processor.cpp
- **Nota:** Del Oppo (2026-10-30, bitácora §173): en la carrera sube 1.250–2.960 KB por cuadro (hasta 3.686 en un menú): 60–110 MB/s copiados desde el wasm. Es el principal sospechoso del lado de la CPU en el teléfono.

#### H13. La tarjeta del teléfono a 2 ms: un camino de dibujo pensado para baldosas

*Alta · Celular · Un jugador y sala · 4–8 semanas · Medido · Recompilar el .wasm · Volver a subir R2 · Medir primero*

- **Qué pasa:** La Wii dibujaba esta escena con una tarjeta muchas veces más débil que la de un teléfono de gama media, así que los 34 ms del Oppo son casi todo desperdicio: 12 pasadas que cargan y guardan la imagen entera en la memoria lenta, vértices leídos desde storage buffers, profundidad de 32 bits. Y el costo crece con lo que se ve (vista angosta 20 ms, ancha 34; §115.5), con la imagen siempre de 640×528: apunta a los vértices, no a los píxeles. Para la gama media, que tiene una tarjeta 5–8 veces más débil que el Oppo, la tarjeta tiene que bajar a unos 2 ms por imagen (12 ms o menos con `?lastreGpu=6`), medido en este PC.
- **Arreglo:** Con el perfil por pasada en la mano (N9, G8):

- atributos de vértice para los formatos comunes, y storage buffers solo para los raros;
- menos pasadas, y `loadOp: clear` / `storeOp: discard` en lo que no se vuelve a leer (la profundidad, casi siempre);
- profundidad de 24 bits;
- las copias del EFB sin pasar por la memoria lenta cuando se pueda;
- texturas ETC2 o ASTC (G6);
- paquetes de dibujo ya validados (render bundles) para la pista quieta (H12);
- la vista en 16:9 (G5).

Todo es visual: no toca la simulación ni quita efectos.
- **Gana:** meta: la tarjeta a 2 ms por imagen en el tramo fijo (con el lastre de tarjeta ×6, 12 ms o menos); el Oppo marcaba ~34
- **Se comprueba:** `perfil-gpu.mjs` por pasada en este PC en el tramo fijo, también con `?lastreGpu=6`; capturas iguales a simple vista.
- **Dónde:** web/navegador/perfil-gpu.mjs; aurora gfx/common.cpp, gx/shader.cpp, gx/pipeline.cpp; bitácora §115.5
- **Nota:** Del Oppo (2026-10-30, bitácora §173): pendiente de confirmar con `tramoMs`: los datos del 30-10 dan la tarjeta ≈ 3 ms (las pasadas se pisan en la tarjeta de mosaicos; lo que frena es la CPU). En este PC, con las marcas de la tarjeta en el tramo fijo, también frena la CPU en todos los escalones (§164); el Oppo ya no se mide (el dueño, 2026-10-31).

## Paso a paso

Siete etapas (versión 4, 2026-10-31) y, al final, lo ya hecho en las versiones 1–3. La etapa 0 son dos semanas de **pilotos que deciden**: cada uno tiene un umbral de éxito y uno de corte, escritos antes de empezar, como la prueba de un prototipo antes de fabricar la serie. La etapa 1 saca el dibujo a otro núcleo (contiene los pasos 8 y 9 viejos, con la puerta A); la 2 es el motor; la 3, simular a 60 y dibujar a 30 donde haga falta; la 4, las islas decompiladas, **solo si los pilotos pasan**, en paralelo con el motor; la 4b, lo ambicioso (hilos de verdad, el dibujo retenido y los saltos en línea; estimada); la 4c, las mejoras chicas medidas juntas (preparada, se ejecuta cuando el dueño lo diga); la 5, las salas; la 6, la página liviana y la prueba final. Cada etapa termina con números medidos («listo cuando»), en la gama baja simulada y en este PC como control, y con lo que te toca a ti.

### Fase 0. Pilotos que deciden (2 semanas, más 2–3 días de los arreglos de KartPad)

Antes de meterle meses a nada, contestar con números las preguntas que deciden el resto: ¿el dibujo es un sumidero y cuántas páginas ensucia la carrera por cuadro (W1)? ¿una isla decompilada de la lógica gana ×2 (W2)? ¿un modelo dibujado en nativo baja 0,5 ms (W3)? ¿PGO gana en la gama baja (W4)? Y medir los teléfonos como son, pagando la revisión de límites de Android (W5, N2), y cuánto pesa la memoria de la Wii en el nativo (W6). Cada piloto tiene su umbral de éxito y de corte escrito en su ítem. Con eso, temprano, los tres arreglos de KartPad (W7–W9).

**Ítems:** W1, W2, W3, W4, W5, W6, N2, W7, W8, W9, W19, W20

**Pasos:**

1. M0: las páginas sucias por cuadro y la prueba del sumidero en 5–10 pistas, también de RR (W1).
2. Semana 1: la isla de la colisión (KCL), con el comprobador en el borde (W2); al lado, el piloto de PGO (W4).
3. Semana 2: un modelo de la pista dibujado en nativo, con la foto contra la de hoy (W3).
4. La simulación del teléfono con `--wasm-enforce-bounds-checks` y la escalera otra vez (W5, N2).
5. El nativo con los bytes dados vuelta como wasm, y el nativo «revisado» en la carrera (W6).
6. Los arreglos de KartPad: el aviso de XF, la memoria tras 8 pistas y la tarjeta en el informe (W7, W8, W9).
7. El veredicto de cada piloto contra su umbral, en la bitácora; con eso se decide la etapa 4 y el orden de la 2.

**Listo cuando:**

- cada piloto con su número y su veredicto (pasa o se mata, según su umbral) escrito en la bitácora
- el sumidero probado en 5–10 pistas (también de RR) y las páginas sucias por cuadro medidas
- la escalera de los teléfonos simulados medida otra vez con la revisión de límites de Android
- los tres arreglos de KartPad revisados

**Lo que hace el dueño:**

- acordar las metas por escalón de la versión 4
- decidir con los números de los pilotos si va la etapa 4

### Fase 1. El dibujo en otro núcleo (6–9 semanas)

Pasar de dos resistencias en serie a dos ramas en paralelo: la carrera en un Worker y el dibujo entero (también el código del juego que recorre la escena) en otro, un cuadro atrás. Funciona porque la carrera nunca lee lo que el dibujo escribe (R2, W1). Primero se termina lo que quedó a medias del paso 8 viejo (el juego en un Worker y la puerta A, §186–§189); después A1-s (W10) y A2 (W11). Lo que servía del paso 9 viejo (aurora y el sonido fuera del hilo de la carrera) queda adentro de esos dos; las variantes con memoria compartida, la aurora nueva y lo que ya no rinde se descartaron en la poda del 2026-10-31.

**Ítems:** W10, W11, N3, P10, H5

**Pasos:**

1. Terminar la prueba del juego en un Worker (§189: la gama baja con 5 pares y las pruebas de la página; sin el programa con memoria compartida, que A1-s no necesita) y decidir la puerta A (N3, P10, H5).
2. A1-s: el Worker B con su copia del juego; A le manda las páginas sucias en cajas y B dibuja el cuadro anterior (W10).
3. Las pruebas de «saltar» de los efectos, los sonidos, la interfaz y el hilo de sonido; lo que pase, a B (W11).
4. Medir en el tramo fijo, la gama baja simulada (con W5) y este PC, intercalados; la sala con dos programas; `correr-todo`.

**Listo cuando:**

- el hilo de la carrera a ~6 ms por cuadro en este PC (hoy 11,1), en el tramo fijo, y la gama baja simulada mejor en la misma proporción
- huellas 75/75 con un programa nuevo y uno de hoy en la misma sala, el fantasma igual cuadro por cuadro y la foto igual
- abrir el juego no atrasa más de 50 ms el latido de otra pestaña
- la segunda copia del juego medida en memoria, y la puerta A decidida con números

**Lo que hace el dueño:**

- subir a R2 el programa nuevo
- decidir en la puerta A

### Fase 2. El motor (8–14 semanas)

Lo que cuesta el código traducido dentro de wasm, atacado donde de verdad cuesta y **sin copiar más código en línea** (eso perdió en la gama baja): la memoria de la Wii (1,1 millones de accesos por cuadro, cada uno de ~13–15 operaciones a ~3–4), la pila, el contexto, las banderas del CR y PGO. El orden lo deciden los pilotos W4 y W6.

**Ítems:** H6, H7, M6, M7, H11, W12, W13, W14

**Pasos:**

1. La memoria de la Wii en un lugar fijo: primero 1a (lo que el traductor ya sabe que es RAM, y la pila), después 1b (una comparación para la E/S) (H6).
2. Si W6 lo justifica: la RAM en el orden de la PC, con una sola puerta para todo lo que la lee desde afuera (H7).
3. PGO con el perfil del nativo, lo frío afuera, y ThinLTO si gana (M6, M7, H11), según el piloto W4.
4. La pila de la Wii en variables locales (W12).
5. El contexto de la CPU en una dirección fija (W13).
6. Las banderas del CR perezosas y el modo seguro de §193 terminado (W14); sin lo que rompe la sala o los fantasmas (las reglas del plan).
7. Cada cambio: `paridad`, el volcado de la RAM, la sala con dos programas y los fantasmas; medido en la gama baja (con la revisión de límites) y en este PC.

**Listo cuando:**

- `paridad`, el volcado de la RAM, la huella ampliada y los fantasmas iguales en cada cambio
- el código traducido ×1,3 o más rápido en la gama baja simulada (con la revisión de límites), en el tramo fijo
- `correr-todo` completo con el programa final

**Lo que hace el dueño:**

- subir a R2 el `.wasm` nuevo (varias veces)

### Fase 3. Simular a 60, dibujar a 30 y mostrar 60 (2–3 semanas)

Donde el Worker del dibujo no llegue a 60 (la gama baja, y la media si queda al borde), la carrera sigue a 60 cuadros por segundo, igual en todos los aparatos, y el dibujo va a 30 con la imagen intermedia de aurora (N8). Es como un televisor de 120 Hz que inventa cuadros: el partido es el mismo, la pantalla se ve pareja. R2 ya probó que saltar el dibujo no cambia la carrera; con el dibujo en otro núcleo, la imagen intermedia sale del hilo de la carrera.

**Ítems:** N8

**Pasos:**

1. aurora no presenta el cuadro saltado y pone en su lugar la imagen intermedia (N8); el salto del dibujo ya está (R2).
2. Que el Worker B decida solo: dibuja 1 de cada 2 cuando no llega a 60 y vuelve a 60 cuando le sobra.
3. Medir en la gama media y la baja simuladas: cuadros de lógica, imágenes dibujadas e intermedias por segundo.
4. Comparar con el modo de 30 fps del propio juego que usa KartPad (solo para medir: el camino de R2 es el seguro para la sala).

**Listo cuando:**

- la gama media y la baja simuladas: 60 cuadros de lógica por segundo y 60 imágenes a la vista, con la huella igual
- en la sala, uno dibujando a 30 y otro a 60: huellas 75/75

### Fase 4. Las islas decompiladas (solo si pasan los pilotos) (12–22 semanas, en paralelo con el motor)

Una **isla** es un subsistema entero que pasa a C++ propio con sus datos en formato nativo, y que solo habla con el resto del juego en su borde: como cambiar un tramo de línea entero por cobre grueso entre dos cajas de empalme. Primero el dibujo (no toca la carrera: no puede romper los fantasmas), después la colisión y la física del kart (exigen los mismos bits que la Wii). Va solo con W2 y W3 aprobados. Todo lo decompilado es derivado del código de Nintendo: carpeta ignorada desde el primer archivo, nunca a git ni publicado; sale solo dentro del `.wasm` privado de R2.

**Ítems:** W15, W16, W17

**Pasos:**

1. Si W3 pasó: D-a, el envío del dibujo en nativo, en el Worker B (W15).
2. Si D-a ganó lo esperado: D-b, el dibujo entero con los efectos (W16).
3. Si W2 pasó: la colisión y después la física del kart, por fases y con el traducido de testigo (W17).
4. Cada isla: el comprobador en el borde, los fantasmas contra el experto, la sala con dos programas y `correr-todo`.

**Listo cuando:**

- cada isla con 0 diferencias en su comprobador, los fantasmas iguales y la sala 75/75
- el dibujo a 3 ms o menos de CPU por imagen en este PC (hoy ~6,7), con las fotos iguales
- la gama media simulada con el hilo de la carrera a 16,7 ms o menos

**Lo que hace el dueño:**

- decidir si se sigue con la IA de la CPU y los objetos
- subir a R2 el `.wasm` nuevo

### Fase 4b. Lo ambicioso: hilos de verdad, el dibujo retenido y los saltos en línea (8–16 semanas (estimado))

Sale de la etapa 4 (bitácora §222): en la gama baja el dibujo cuesta ~10 de ~20 ms y los modelos son solo 0,6–0,7 ms; ~9 ms son el esqueleto fijo de cada imagen. Se junta con W10 (etapa 1, abierta) y N8 (etapa 3, hecha). Techo honesto: a la gama baja le faltan ×3,2 de lógica para 60 y nada de aquí da ×3 por sí solo; la combinación realista es W21 + W22 + N8 (se ve a 60 dibujando a 30), W23 para la lógica y W24 o el video (N11) para la sala. Todo estimado, nada medido todavía.

**Ítems:** W21, W22, W23, W24

**Pasos:**

1. Día 1 de W21: el service worker en el sitio local; el ingreso con Firebase, los marcos y el Worker de R2 siguen andando; `crossOriginIsolated` verdadero.
2. Día 1 de W22 (horas): el esqueleto del dibujo medido por partes con los contadores que ya hay; si la sospecha se confirma, el dibujo retenido.
3. Día 1 de W23: la prueba chica de las indirectas escrita de las dos formas, en Chrome; si gana, el traductor y después el juego.
4. Con memoria compartida, el dibujo en otro núcleo sin copias (W10); W24 (opcional) solo si la caja por cuadro se comprime lo bastante.
5. Cada pieza adoptada: gama baja simulada y este PC, con huellas, fantasmas y foto iguales.

**Listo cuando:**

- el sitio local entero con aislamiento y `crossOriginIsolated` verdadero en el marco del juego (W21)
- el esqueleto medido por partes y, si se construye, el dibujo por cuadro más bajo en la gama baja simulada con la foto igual (W22)
- la prueba chica y después el juego, con huellas 75/75 y el fantasma igual (W23)
- cada pieza adoptada medida en la gama baja simulada y en este PC, con las pruebas de igualdad completas

**Lo que hace el dueño:**

- confirmar el PR del sitio antes de W21 en Paginita-Pro (cada vez)
- subir a R2 el `.wasm` nuevo si W22 o W23 se adoptan

### Fase 5b. La sala: 3 conexiones (1–2 semanas (estimado))

Pedido del dueño (2026-11-05): que el anfitrión elija cómo se conecta la sala, con nombres cortos y un textito al pasar el cursor (R11). El árbitro en un jugador ya va por omisión.

**Ítems:** R11

**Pasos:**

1. El servidor árbitro en Node (`wss://`) y su conexión desde la página, con la vuelta sola al host si no contesta.
2. Las tres opciones en el vestíbulo del sitio, con sus textos, y `&conexion=host|cloudflare|oracle` hasta el lockstep.
3. Las pruebas: el banco con un servidor local de mentira, `prueba-sincro --directa` en cada modo, el sitio `mkw.test.cjs`.
4. Los pasos para el dueño: `docs/publicar-oracle.md` (cuenta, región Santiago, VM ARM, puertos, dominio y Let’s Encrypt, systemd, las trampas).

**Listo cuando:**

- las tres opciones en el vestíbulo con su texto al pasar el cursor
- con el servidor de mentira, la misma carrera (huellas iguales), la vuelta al host al cortarlo y la traba de uno sin frenar a los demás
- `prueba-sincro --directa` en verde con cada modo

**Lo que hace el dueño:**

- crear la cuenta de Oracle y la máquina (la tarjeta la pones tú)
- confirmar el PR del sitio (cada vez)

### Fase 7. El plan combinado: W10 primero, gráficos al final (semanas a meses (estimado))

El dueño (2026-11-07): juntar el plan de Codex (CPU: W10, W26, W27, W28) con los gráficos opcionales para los aparatos que frena la tarjeta (teléfonos y PC con gráficos integrados) (G11–G14): «lo importante al final es el gameplay». Corrección del mismo día: la tarjeta no frena (§173), así que primero W10 y los gráficos quedan en prioridad baja. Se empieza después del reinicio semanal. Detalle en `docs/plan-combinado.md`.

**Ítems:** W29, W26, V8, W27, W28, G11, G12, G13, G14, G15, G16, G16b, W30, W31, W32

**Pasos:**

1. El piloto chico: la memoria del wasm de tamaño fijo (W29), contra la revisión de límites de Android.
2. Terminar W10 (parte B): el dibujo en otro núcleo, el freno real (la CPU; la tarjeta trabaja ≈3 ms en el Oppo, §173), y la memoria para horas (W26).
3. Repartir por partes los ~10 ms del lado CPU del dibujo (V8; lo de la tarjeta ya está medido).
4. Condicionadas: W27 si el dibujante pasa a ser el cuello; W28 solo con un piloto que gane.
5. Al final, en prioridad baja: los gráficos opcionales para un aparato que de verdad frene por la tarjeta (G11, G12, G13; G14 solo si pesan los vértices).

**Listo cuando:**

- W10 medido en la gama baja simulada y en este PC
- el lado CPU del dibujo repartido por partes
- una hora de sala con la memoria plana

**Lo que hace el dueño:**

- confirmar el PR del sitio (cada vez)

### Fase 4c. Las mejoras chicas, juntas (1–2 semanas (estimado))

Pedido del dueño (2026-11-05): lo que dio +1 a +6 % y se descartó porque el ruido de la gama baja (±5 %) lo tapaba, medido junto en un paquete (W25). Una suma de +8 % sí sobresale del ruido. Preparada para después de E4b; no se ejecuta hasta que el dueño lo diga. El detalle en `docs/evaluacion-chicas.md`.

**Ítems:** W25

**Pasos:**

1. Pasar cada pieza (C2 texturas BC1, C3 funciones calientes, C4 memo ×4, C5 no releer r14–r31, C6 CR seguro, C7 `wasm-opt -O3`) a la base de E4b, con su interruptor de compilación y su arranque y fantasma iguales.
2. El paquete entero con la igualdad completa: arranque 13/13, sala 75/75 con los dos programas, fantasma y foto iguales.
3. El paquete contra la base, intercalados: gama baja simulada (tramo fijo, `--wasm-enforce-bounds-checks`, N8 apagado) y este PC; 2 pares si ≥ +8 % o ≤ −2 %, hasta 6 en la zona gris; se adopta con la media de 6 pares positiva y este PC sin perder más de 1,5 %.
4. Opcional: sacar de a una solo las que tienen costo propio (C2, C5).
5. El sello: PGO (C1) encima del paquete, con el perfil rehecho solo en cada `--final`, medido con la misma regla.

**Listo cuando:**

- cada pieza pasada a la base de E4b con su interruptor, y el paquete con las pruebas de igualdad completas
- el paquete medido contra la base en la gama baja simulada y en este PC, decidido con la regla del paquete
- PGO encima del paquete decidido, medido con la misma regla y con el perfil rehecho solo en `--final`

**Lo que hace el dueño:**

- decir cuándo se ejecuta
- subir a R2 el `.wasm` nuevo si se adopta

### Fase 5. Las salas (3–6 semanas)

Que la gama baja también juegue en la sala: un PC de la sala dibuja también la vista del teléfono y se la manda en video, y el teléfono solo muestra y manda sus botones (N11). Y lo que quedaba pendiente de la sala (R4). El árbitro y saltarse el dibujo ya están hechos (paso 11 viejo).

**Ítems:** N11, R4

**Pasos:**

1. El video desde un PC de la sala para el teléfono que no simula 60 (N11).
2. El lockstep sin basura por cuadro (R4).
3. La sala con el árbitro y uno como teléfono (emulación y el lastre de gama media): 3 carreras con la huella ampliada.

**Listo cuando:**

- un teléfono de gama baja simulado ve la carrera a 60 por video desde un PC de la sala, con la demora del botón a la imagen medida
- una traba de 1,5 s de un jugador les cuesta menos de 20 ms a los demás, con el árbitro (`prueba-relevo --trabas=8`)
- en este PC, un Chrome normal y otro como teléfono: 3 carreras con la huella ampliada igual

**Lo que hace el dueño:**

- decidir si el árbitro queda por omisión

### Fase 6. La página liviana y la prueba final (1–2 semanas)

Lo que quedó de los pasos 12 y 16 viejos que todavía rinde: el puente del sonido sin basura, decir en la página lo que no se puede, y la prueba que cierra todo: la escalera medida otra vez contra las metas de la versión 4, la sala de 12 con lo que hay y sesiones largas. Los mandos, el «modo juego» del sitio, el reloj del monitor, los avisos de ahorro y calor, y el dominio y el tope del Worker se descartaron en la poda del 2026-10-31.

**Ítems:** P5, N12, V6, V7

**Pasos:**

1. El puente del sonido con búferes reciclados y una sola llamada por entrega (P5).
2. Decir en la página lo que no se puede, y avisar en la sala antes de largar a quien no simula 60 (N12).
3. La escalera otra vez contra las metas de la versión 4; sesiones largas y la sala de 12 con lo que hay: varios Chrome (uno como teléfono) y consolas de mentira (V6, V7).

**Listo cuando:**

- casi ninguna limpieza de memoria en un minuto de carrera
- cada escalón medido otra vez contra su meta de la versión 4
- la sala de 12 con su meta por escalón, sin esperas de más de 50 ms, y una hora de sala con la memoria plana
- `correr-todo` en verde

**Lo que hace el dueño:**

- confirmar el PR (cada vez)

### Fase ✓. Lo ya hecho (versiones 1–3) y lo descartado en la poda (del 2026-10-27 al 2026-10-31)

Lo que se hizo o se descartó en esos cinco días, con su fecha y dónde se documentó en «Avance»: medir (los cuadros de lógica, el impuesto del navegador, el aparato de mentira y la escalera), que nada se trabe al cargar, que nada se baje en la carrera, la sala asíncrona (el árbitro y saltarse el dibujo sin cambiar la carrera), buena parte de la página liviana, la memoria rápida del motor (M1/M2), la subida a WiiCompiled v0.9.3 (N15) y no volver a subir lo que no cambia. Y lo que se probó y no ganó, que es lo que llevó a la versión 4: la IA en lo caliente, la FMA «punto medio», las pasadas del traductor. Al final, los 18 ítems que sacó la poda del 2026-10-31 (el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo»), cada uno con su porqué.

**Ítems:** N15, H3, H4, N4, G9, P9, N15b, M9, D11, D10, M11, W18, P1, P2, U4, E1, E2, D7, D14, V5, V4, G8, V1, H1, H2, N1, N13, V2, V3, R5, R6, U3, E4, E5, C1, C4, C6, C7, C8, C10, D2, D6, D13, U1, D1, D3, D4, D5, D8, D9, D12, U2, C2, C3, C5, M8, M1, M2, N14, G3, H12, N9, G5, G2, G7, G10, H13, R3, R2, G1, R1, R7, R9, P3, P4, P6, P7, P8, R8, R10, E3, E6, C9, M3, M5, H8, H9, M4, M10, N5, N6, H10, N7, G6, G4, N10

**Pasos:**

1. Medir: el informe con juego, espera y tarjeta; los cuadros de lógica; el impuesto del navegador (×2,45–2,63); el aparato de mentira y la escalera en el tramo fijo.
2. La carga y las descargas: el precalentado con tope, el freno, el paquete de carrera, una versión por archivo; cero pedidos a la red con la carrera andando.
3. La sala: el árbitro, la traba viva, la autoridad por capacidad y saltarse el dibujo sin cambiar la carrera.
4. El motor: M1/M2 (+5,2 % en la gama baja); lo que no ganó (N14, la FMA «punto medio», las hojas en línea, la memo de indirectas, las banderas) quedó descartado con sus números.

**Listo cuando:**

- cada ítem con su fecha y dónde se documentó (bitácora §117–§193)

## Reglas que no cambian

- Nunca menos karts ni menos efectos para ganar fps: siempre 12 karts, en el PC, en el teléfono y en la sala. El rendimiento sale de optimizar el motor, aurora y la página. Dibujar a 30 con la imagen intermedia (N8) no saca nada: corren los 12 karts y se dibujan todos los efectos.
- El producto es siempre la página, nunca una app descargable; el programa nativo es solo un instrumento de medida.
- Nada que cambie la simulación sin la huella ampliada y los fantasmas: la sala y los fantasmas expertos de RR exigen los mismos bits en todos los aparatos, y los fantasmas tienen que seguir iguales bit a bit. Sin fast-math y sin SIMD relajado.
- Nada del juego entra a git ni se publica: el `.wasm`, el C++ traducido, `carreras.json`, `bloques.json` y los paquetes van solo a R2 privado, detrás del Worker. **Lo decompilado también**: es derivado del código de Nintendo igual que el traducido; vive en una carpeta ignorada (agregada a `.gitignore` antes del primer archivo), nunca a git ni publicado, y sale solo dentro del `.wasm` privado que sirve el Worker desde R2. El perfil de PGO lleva nombres del juego: tampoco a git.
- Cada piloto de la etapa 0 tiene un umbral de éxito y uno de corte escritos antes de empezar: si no pasa, se mata y no se discute.
- R2, el Worker, Firebase y el dominio los publica el dueño. PR y merge en Paginita-Pro solo con su confirmación, cada vez.
- Decompilar uno mismo (el C++ traducido, la memoria del juego corriendo, el desensamblado): se lee para entender y se escribe una implementación propia o un gancho; nunca se copia ni se publica.
- Medir antes y después de cada cambio con el mismo guion: si un cambio no se ve en los números, no se queda.
- Medir en la escalera: este PC de verdad (varios Chrome, y Chrome con la emulación de teléfono) y los demás escalones con el aparato de mentira (H1) en el tramo fijo (§163); los teléfonos simulados, con la revisión de límites de Android (W5); el Oppo ya no se mide (el dueño, 2026-10-31). Cada optimización se mide en la gama baja simulada y en este PC como control, intercalados. Una meta que solo se cumple en los más rápidos no está cumplida.
- La carrera no se reparte entre núcleos: lo que corre en otro hilo nunca escribe algo que la carrera lea (W1, W10).
- Nada que no rinda (poda del 2026-10-31, el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo»): un ítem se queda solo si gana ~2 % o más del hilo del juego en la gama media o baja (medido o bien estimado), si otro ítem que se queda lo necesita para medirse, o si arregla algo que un jugador notaría (la imagen, la memoria, la sala). Lo que no rompe la sala ni los fantasmas pero no gana, no entra.
- Nada que agregue copias en línea sin un perfil que lo pida, ni reescrituras de a una función: ya se midió que pierden (N14, M8).
- Cada paso con su prueba (banco o juego), documentado en `docs/bitacora.md` con el glosario y marcado en `PLAN.md` con fecha y hora. Las pruebas en Chrome van sin sonido y solo se cierran los procesos propios.

## Decisiones que quedan para el dueño

- ¿Qué meta para cada escalón de aparatos (N2)? Propuesta de la versión 4 (estimada): PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados, al borde (si no entra, 60 de carrera con 30 dibujados y la imagen intermedia); teléfono de gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC (N11). Siempre en la página, con 12 karts y todos los efectos.
- ¿Va la etapa 4 (las islas decompiladas, meses de trabajo)? Se decide con los números de los pilotos W2 y W3 al terminar la etapa 0.
- El aparato de prueba es este PC (varios Chrome, y Chrome con la emulación de teléfono); el Oppo ya no se mide (el dueño, 2026-10-31); los demás escalones se simulan (H1). Opcional: si alguna vez alguien con un teléfono de gama media corre el informe (2 minutos), es el único dato que corrige la simulación.
- La puerta A: ¿el juego pasa a un Worker (N3, P10)? Es la base del dibujo en otro núcleo, que va sin memoria compartida (W10, con la cinta de cajas de H5); el sitio sigue en GitHub Pages.
- ¿Un cuadro más de demora (16,7 ms) a cambio de que el dibujo vaya en otro núcleo, un cuadro atrás (W10)? Se mide con `mkwMedirDemora`.
- ¿Ver por video a los teléfonos débiles en las salas que tengan un PC (N11)? Cualquier teléfono a 60, con más demora.
- ¿El árbitro queda por omisión cuando esté probado, o como opción? Suma 1–2 cuadros de retraso a cambio de que el lento no frene a nadie.
- ¿Te parece bien el aspecto sin desenfoques en lo que va encima del juego (el descanso, el plano de la copa)?

## Glosario corto

- **Cuadro (frame):** una vuelta completa del juego: calcular y dibujar. A 60 fps hay 16,7 ms para cada una, como el período de una señal de 60 Hz.
- **Pipeline:** la «receta» ya compilada que la tarjeta de video usa para dibujar un material. Compilar una cuesta decenas de ms (en el teléfono, hasta 1 s), y el juego usa unas 900.
- **Precalentado:** compilar los pipelines antes de necesitarlos, como precalentar un horno.
- **Proceso de GPU:** el programa de Chrome que habla con la tarjeta de video. Es uno solo para todas las pestañas: como un transformador que alimenta todo el tablero.
- **Lockstep:** todas las consolas simulan lo mismo, cuadro a cuadro, con los mismos botones; avanzan juntas como relojes que solo dan el paso cuando todos lo dieron.
- **Árbitro:** una consola que decide los botones de todos en cada cuadro; las demás se enganchan a ella como un PLL a un reloj maestro.
- **Rollback:** correr adelantado y, si llegan botones distintos, volver atrás y recalcular. Exige guardar el estado entero varias veces por segundo.
- **Determinismo:** mismas entradas → exactamente el mismo resultado, bit a bit, en cualquier aparato.
- **JSPI:** lo que deja al juego (WebAssembly) pausarse para esperar a JavaScript (una descarga, los botones) sin perder su lugar.
- **Fibra:** un «hilo» del juego que en realidad se turna con los demás dentro de un solo hilo del navegador.
- **GPU por baldosas:** la tarjeta de los teléfonos dibuja la pantalla por cuadraditos en una memoria interna rápida; ir y volver a la memoria principal es lo caro.
- **Ubershader:** un shader general que dibuja cualquier material (más lento) mientras se compila el específico.
- **Liftoff y TurboFan:** los dos compiladores de WebAssembly de Chrome: uno compila rápido y el otro produce código más rápido.
- **Limpieza de memoria (GC):** el navegador libera los objetos que ya no se usan; cada limpieza detiene el hilo un rato.
- **Cubeta de fichas:** un limitador de velocidad: cada byte gasta una ficha y las fichas se reponen a ritmo fijo.
- **Paquete de carrera:** todos los archivos que una carrera va a leer, bajados juntos antes de la cuenta.
- **Document-Isolation-Policy:** una cabecera que aísla una página (o un marco) en su propio proceso y le da memoria compartida, sin aislar todo el sitio.
- **SFU:** un servidor que reenvía: cada uno sube una sola vez y el servidor reparte a los demás.
- **PGO:** compilar guiado por un perfil: el compilador sabe qué partes son calientes y las ordena mejor.
- **Huella:** un resumen del estado de la carrera que las consolas comparan para saber si siguen iguales.
- **Rango resuelto:** un grupo de accesos a memoria con la misma base que el traductor ya calculó; hoy en wasm siempre cae al camino lento.
- **Caché del borde:** copias guardadas en el centro de datos de Cloudflare más cercano al jugador.
- **Núcleo e hilo:** un núcleo es un procesador dentro del chip; un hilo es una fila de trabajo que corre en uno. Hoy el juego es una sola fila: aunque el teléfono tenga 8 núcleos, usa uno.
- **Worker:** un hilo aparte que el navegador le da a una página. No toca la pantalla de la página, pero puede dibujar con WebGPU en un `OffscreenCanvas`.
- **Memoria compartida:** memoria que dos hilos leen y escriben a la vez (`SharedArrayBuffer`). El navegador solo la da a páginas aisladas.
- **Impuesto del navegador:** lo que cuesta de más correr el juego en WebAssembly dentro de Chrome, comparado con un programa nativo en el mismo aparato.
- **Escalera de aparatos:** seis aparatos de referencia, del más rápido al más lento, para medir y fijar una meta en cada escalón.
- **Interpolación de cuadros:** inventar un cuadro intermedio entre dos dibujados, con cada modelo a mitad de camino.
- **App nativa:** un programa compilado para el procesador del teléfono e instalado aparte: usa todas sus instrucciones y núcleos, sin el navegador en el medio.
- **Puerta de decisión:** un punto del plan donde se mide y se decide si seguir por un camino o tomar otro.
- **Cuello de botella:** la pieza más lenta de una fila: marca el ritmo de todo, como la resistencia más grande en un circuito en serie.
- **Cuadros en vuelo:** cuántos cuadros están a medio hacer a la vez. Con dos, la tarjeta dibuja uno mientras el procesador calcula el siguiente: trabajan en paralelo y no en serie.
- **Presupuesto por pieza:** cuántos ms puede gastar cada parte (cada hilo y la tarjeta), como el presupuesto de potencia de un diseño.
- **Aparato de mentira:** el PC frenado a propósito y en forma calibrada para que trabajen como un aparato más lento: una carga ficticia de banco de pruebas.
- **Lastre:** trabajo inútil agregado a propósito para simular un aparato más lento: en la CPU, esperar ocupado; en la tarjeta, repetir pasadas.
- **Ladrón de caché:** un hilo que recorre mucha memoria sin parar para sacar al juego de la caché grande, como si corriera en un procesador de caché chica.
- **Caché del procesador:** una memoria chica y muy rápida dentro del chip; lo que no está ahí se trae de la memoria grande, decenas de veces más lenta.
- **Orden de los bytes:** en qué orden se guardan los bytes de un número: la Wii pone primero el más grande, el PC y el teléfono el más chico. Pasar de uno al otro es «dar vuelta los bytes».
- **FIFO de la Wii:** la cola donde el procesador dejaba los comandos de dibujo para que el chip gráfico los leyera a su ritmo; la versión 3 la recupera entre dos hilos.
- **Núcleos grandes y chicos:** los teléfonos mezclan núcleos rápidos, para lo pesado, y lentos que gastan poco; la gama media suele tener 4 y 4.
- **Factor de seguridad:** diseñar con margen, como usar un componente al 70 % de lo nominal: la meta de 12 ms cubre lo que la simulación no copia.
- **Piloto (con umbral):** una prueba chica y corta antes de la obra grande, con un número que la aprueba y otro que la mata escritos antes de empezar: como probar un prototipo antes de fabricar la serie (versión 4).
- **Sumidero:** una parte del programa que solo recibe: la carrera nunca lee lo que el dibujo escribe. Como un voltímetro: si se conecta mal marca mal, pero no cambia el circuito.
- **Páginas sucias:** los pedazos de 4 KiB de la memoria que se escribieron en un cuadro. Solo esos hay que mandarle al otro Worker: como un medidor por circuito que anota qué circuitos se usaron, sin mirar cada electrón.
- **A1-s:** el dibujo y la presentación en un segundo Worker con su propia copia del juego, un cuadro atrás, sin memoria compartida: la carrera le manda las páginas sucias en cajas. Pasa de dos resistencias en serie a dos ramas en paralelo.
- **Isla (decompilada):** un subsistema entero (el dibujo, la colisión, la física del kart) reescrito en C++ propio con sus datos en el formato de la PC; solo habla con el resto del juego en su borde. Como cambiar un tramo de línea entero por cobre grueso.
- **Borde de la isla:** donde el código traducido y la isla se pasan datos; ahí sí se dan vuelta los bytes, pero una vez por consulta o por cuadro, no en cada lectura. Como el transformador entre dos tramos: tiene pérdidas, pero una vez.
- **Decompilación funcional:** reescribir lo que hace cada función como C++ normal que da el mismo resultado, bit a bit, aunque el código de máquina sea otro. Lo opuesto a la «matching», que busca los mismos bytes del disco.
- **Revisión de límites:** antes de cada acceso a la memoria, comprobar que la dirección cae dentro del espacio del programa. En el PC la hace gratis el sistema (páginas de guarda); Chrome en Android la hace con una instrucción cada vez: +16 %.
- **Contexto de la CPU:** el lugar donde el código traducido guarda los registros de la Wii entre una función y otra. Si vive en una dirección fija, se llega a él sin pasar un puntero.
- **Banderas del CR perezosas:** en vez de armar en cada comparación los bits de resultado que la Wii guarda, guardar el resultado y sacar el bit solo cuando alguien lo lee, como hace Dolphin.
- **Render bundle:** una lista de órdenes de dibujo de WebGPU grabada una vez y repetida en cada imagen casi gratis: como un programa grabado en una ROM en vez de dictar las órdenes a mano cada vez.
- **Revisión de límites forzada (`--wasm-enforce-bounds-checks`):** una bandera de V8 que hace que este PC revise los límites como un teléfono Android; solo para medir.
- **KartPad:** otro proyecto que usa el mismo traductor (WiiCompiled) para correr Mario Kart Wii con Retro Rewind nativo en Android y Apple: dice cuánto tarda el código traducido sin el navegador en teléfonos de verdad.
- **Ley de Amdahl:** lo que no se toca pone el techo: si una resistencia en serie es el 20 % del total, aunque se la cortocircuite la corriente sube solo ×1,25.

## De dónde sale esto

Seis investigaciones del 2026-10-27, todas de solo lectura (no se corrió el juego): la carga y el proceso de GPU; las descargas y el disco; el multijugador asíncrono; el motor, aurora y la lista priorizada; la plataforma web (Chrome 156, Emscripten, V8, Dawn, Cloudflare, Firebase, WebRTC); y la auditoría del código de la página. Las mediciones citadas están en `build/web/datos/` y en `docs/bitacora.md` (§54, §62, §80, §85, §88, §93, §99–§104, §114–§115).

Versión 2, el mismo día: la revisión honesta, leyendo el código traducido (`generated/build_shards`: las funciones hoja en línea y las llamadas «statefree» ya existen), la memoria en wasm (`runtime/include/guest_flat_memory.h` y `memory_access.h`: sin vista plana, todo acceso revisado), la interpolación de aurora (`lib/gx/frame_interpolation.*`) y la bitácora (§85, §113–§115). Las velocidades de un núcleo por escalón son aproximadas (de Geekbench 6) y hay que medirlas (N2).

Versión 3, el mismo día: el acceso a memoria en wasm (`runtime/include/memory_access.h:356-410`), la multiplicación-suma exacta (`runtime/include/isa/ppc_isa_wasm_neon.h`), una función de matrices traducida (`generated/functions/func_80199D64.cpp`), la bitácora §115 (12 pasadas, 200–420 dibujos y 1,1–2,5 MB subidos por cuadro) y Document-Isolation-Policy (developer.chrome.com: Chrome 137 en el escritorio; en Android, sin confirmar, según la discusión de abril de 2025 en public-webapps del W3C). Los factores de la gama media (CPU ×3,5 y tarjeta ×5–8 del Oppo) son aproximados, de pruebas públicas (Geekbench 6, 3DMark Wild Life Extreme), y se calibran con el aparato de mentira.

Versión 4, el 2026-10-31: cinco documentos del proyecto escritos ese día sin correr el juego, todos con cada número marcado como medido o estimado: `docs/techo-pasos.md` (el techo de lo que quedaba: ×1,5 realista), `docs/soluciones-motor.md` (el motor: la memoria, la pila, el contexto, las banderas, PGO, la revisión de límites de Android), `docs/soluciones-arquitectura.md` (el perfil de §160 reagrupado por partes del cuadro, el sumidero, A1-s y A2), `docs/soluciones-decompilacion.md` (las islas, el piloto de dos semanas y sus umbrales) y `docs/kartpad.md` (KartPad: el mismo traductor nativo en teléfonos reales, PGO −12 %, y tres arreglos de correctitud). Los números de la versión 4 por escalón son estimados y los confirman o los bajan los pilotos de la etapa 0.

Fuentes externas principales: developer.chrome.com (Document-Isolation-Policy, WebGPU 121–146, ahorro de energía), v8.dev (caché de código wasm, compilación por niveles), dawn.googlesource.com, developers.cloudflare.com (Workers, R2, Durable Objects, Realtime SFU), firebase.google.com/docs/database/locations, gafferongames.com (lockstep determinista), web3dsurvey.com, decomp.dev/doldecomp/mkw y github.com/vabold/Kinoko.

## Orden de trabajo y cuánto tarda

Este es el orden de la **versión 4** (2026-10-31): siete etapas (más la 4b, agregada el 2026-11-04 con lo ambicioso que dejó la etapa 4, y la 4c, agregada el 2026-11-05: las mejoras chicas medidas juntas). Primero **dos semanas de pilotos que deciden** (etapa 0): cada uno tiene un número que lo aprueba y otro que lo mata, para no meterle meses a algo que no rinde, que es lo que pasó con varias piezas de la versión 3. Después **el dibujo en otro núcleo** (etapa 1, contiene los pasos 8 y 9 viejos), **el motor** (etapa 2), **simular a 60 y dibujar a 30** con la imagen intermedia (etapa 3), **las islas decompiladas**, solo si los pilotos pasan (etapa 4, en paralelo con el motor), **las salas** (etapa 5) y **la página liviana y la prueba final** (etapa 6). El mismo día, más tarde, la **poda** (el dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo») sacó 18 ítems de las etapas: quedan solo los que ganan en la gama media o baja, los que hacen falta para medirlos y los arreglos que un jugador notaría (paso 17 de la historia).

Todo se comprueba en este PC: con el aparato de mentira (H1), ahora pagando la revisión de límites de Android (W5), el tramo fijo (§163) y Chrome con la emulación de teléfono; el Oppo ya no se mide (el dueño, 2026-10-31). Cada optimización se mide en la gama baja simulada y en este PC como control. Las semanas son de trabajo, no de calendario. Cada etapa termina con sus criterios medidos (las casillas de «Avance») y con lo que te toca a ti, si algo te toca.

| Paso | Qué | Fase | Ítems | Dura | Termina hacia la semana | Lo que haces tú |
|---|---|---|---|---|---|---|
| E0 | **Etapa 0 — Pilotos que deciden.** Antes de gastar meses, seis preguntas con un número que las aprueba y otro que las mata: ¿el dibujo es un sumidero y cuántas páginas ensucia la carrera (W1)? ¿una isla decompilada de la lógica gana ×2 (W2)? ¿un modelo dibujado en nativo baja 0,5 ms (W3)? ¿PGO gana en la gama baja (W4)? Y medir como son los teléfonos (W5, N2) y cuánto pesa la memoria de la Wii en el nativo (W6). Con eso, los arreglos de KartPad (W7–W9, W19, W20). | 0 | W1, W2, W3, W4, W5, W6, N2, W7, W8, W9, W19, W20 | 2 semanas, más 2–3 días de los arreglos de KartPad | 2–3 | acordar las metas por escalón de la versión 4, y decidir con los números de los pilotos si va la etapa 4 |
| E1 | **Etapa 1 — El dibujo en otro núcleo.** Terminar la prueba del juego en un Worker y la puerta A (lo que quedó del paso 8 viejo, §186–§189), y sobre eso **A1-s**: el dibujo y la presentación en un segundo Worker, un cuadro atrás, con las páginas sucias transferidas en cajas, sin memoria compartida (W10); después **A2**, lo que solo se ve de la parte de calcular, con el hilo de sonido (W11). Lo del paso 9 viejo (aurora y el sonido fuera del hilo de la carrera) va adentro de esos dos; las variantes con memoria compartida y la aurora nueva se descartaron en la poda del 2026-10-31. | 1 | W10, W11, N3, P10, H5 | 6–9 semanas | 8–12 | subir a R2 el programa nuevo y decidir en la puerta A |
| E2 | **Etapa 2 — El motor.** Lo que cuesta el código traducido dentro de wasm, sin copiar más código en línea: la memoria de la Wii en un lugar fijo (H6, primero la parte 1a: lo que el traductor ya sabe que es RAM) y, si W6 lo justifica, guardada en el orden de la PC (H7); PGO con lo frío afuera (M6, M7, H11); la pila en variables locales (W12); el contexto en una dirección fija (W13); y el CR perezoso con el modo seguro de §193 terminado (W14). | 2 | H6, H7, M6, M7, H11, W12, W13, W14 | 8–14 semanas | 16–26 | subir a R2 el `.wasm` nuevo (varias veces) |
| E3 | **Etapa 3 — Simular a 60, dibujar a 30 y mostrar 60.** La carrera sigue a 60 cuadros por segundo, igual en todos los aparatos; el Worker del dibujo dibuja 1 de cada 2 y aurora pone la imagen intermedia (N8). R2 ya probó que saltar el dibujo no cambia la carrera; con el dibujo en otro núcleo, la imagen intermedia sale del hilo de la carrera. | 3 | N8 | 2–3 semanas | 18–29 | — |
| E4 | **Etapa 4 — Las islas decompiladas.** Solo con los pilotos W2 y W3 aprobados. El renderizador WebGPU propio, primero el envío (W15, D-a) y después el dibujo entero con los efectos (W16, D-b); la colisión y la física del kart (W17). No se pisa con el motor (otros archivos), por eso puede ir al mismo tiempo. Todo lo decompilado es derivado del código de Nintendo: nunca a git ni publicado; sale solo dentro del `.wasm` privado de R2. | 4 | W15, W16, W17 | 12–22 semanas, solo si pasan los pilotos; en paralelo con el motor | 20–34 | decidir si se sigue con la IA de la CPU y los objetos |
| E4b | **Etapa 4b — Lo ambicioso: hilos de verdad, el dibujo retenido y los saltos en línea.** Sale del hallazgo de la etapa 4 (bitácora §222): en la gama baja el dibujo cuesta ~10 de ~20 ms por cuadro y esconder todos los modelos ahorra solo 0,6–0,7 ms, así que ~9 ms son el esqueleto fijo de cada imagen (el 2D, las copias de imagen, el posproceso y el trabajo base de aurora). Se suma a W10 (etapa 1, abierta) y a N8 (etapa 3, hecha; el dueño la permitió en «Automático», 2026-11-04). Techo honesto: a la gama baja le faltan ×3,2 de lógica para 60 y nada de aquí da ×3 por sí solo. La combinación realista: W21 + W22 + N8 para que se vea a 60 dibujando a 30; W23 para la lógica; y W24 o el video (N11) para la sala. Todo lo de esta etapa son estimados: nada está medido todavía. | 4b | W21, W22, W23, W24 | 8–16 semanas (estimado), junto con W10 (etapa 1) y N8 (etapa 3) | 28–50 | confirmar el PR del sitio antes de W21 en Paginita-Pro (cada vez) |
| E4c | **Etapa 4c — Las mejoras chicas, juntas.** Pedido del dueño (2026-11-05): las mejoras de +1 a +6 % que se descartaron porque el ruido de ±5 % las tapaba, medidas juntas en un paquete (W25): PGO, texturas BC1 en los PC, tres funciones calientes, el memo ×4, no releer r14–r31, el CR seguro y `wasm-opt -O3`. Todas dan la misma carrera. PGO va al final, como sello, con el perfil rehecho solo en cada programa final. El detalle en `docs/evaluacion-chicas.md`. | 4c | W25 | 1–2 semanas (estimado), después de E4b; preparada, no se ejecuta hasta que el dueño lo diga | 29–52 | decir cuándo se ejecuta; subir a R2 el `.wasm` nuevo si se adopta |
| E5 | **Etapa 5 — Las salas.** Para la gama baja en la sala, el video desde un PC: el PC dibuja también la vista del teléfono y se la manda (N11); y lo que quedaba pendiente de la sala (R4). | 5 | N11, R4 | 3–6 semanas | 32–58 | decidir si el árbitro queda por omisión |
| E5b | **Etapa 5b — La sala: 3 conexiones.** Pedido del dueño (2026-11-05): en la sala, tres formas de conectarse, con nombres cortos y un textito al pasar el cursor (R11): «Host: un jugador» (el árbitro en una PC, por omisión), «Host + repetidor Cloudflare» (el TURN de §103, cobra por MB) y «Servidor Oracle» (un árbitro propio en la VM gratis de Oracle en Santiago; si no contesta, vuelve al host). | 5b | R11 | 1–2 semanas (estimado); pausada por el dueño el 2026-11-05 | 33–60 | crear la cuenta de Oracle; confirmar el PR del sitio (cada vez) |
| E6 | **Etapa 6 — La página liviana y la prueba final.** Lo que quedó de los pasos 12 y 16 viejos que todavía rinde: el puente del sonido sin basura (P5), decir en la página lo que no se puede (N12), y la escalera medida otra vez contra las metas de la versión 4 con la sala de 12 y sesiones largas (V6, V7). Lo demás (los mandos, el «modo juego» del sitio, el reloj del monitor, los avisos de ahorro y calor, el dominio y el tope del Worker) se descartó en la poda del 2026-10-31: con el juego en un Worker no toca el cuadro de la carrera, o no es rendimiento. | 6 | P5, N12, V6, V7 | 1–2 semanas | 34–62 | confirmar el PR (cada vez) |
| E7 | **Etapa 7 — El plan combinado: W10 primero, gráficos al final.** El dueño (2026-11-07): el plan de Codex acelera la CPU (sirve en el PC flojo); corrección del 2026-11-07: el teléfono probado frenaba por la CPU, no por la tarjeta (§173: ≈3 ms de tarjeta), así que lo que rinde es W10; los gráficos opcionales quedan en prioridad baja, solo para un aparato que de verdad frene por la tarjeta (por omisión todo prendido, siempre 12 karts). Orden: el piloto chico de la memoria de tamaño fijo (W29, 1–2 días) → W10 parte B (el freno real, la CPU) y la memoria (W26) → repartir los ~10 ms del lado CPU del dibujo (V8) → condicionadas W27 (si el dibujante pasa a ser el cuello) y W28 → al final, en prioridad baja, los gráficos opcionales (G11–G13, G14 condicionado). | 7 | W29, W26, V8, W27, W28, G11, G12, G13, G14, G15, G16, G16b, W30, W31, W32 | semanas a meses (estimado); después del reinicio semanal | 38–74 | confirmar el PR (cada vez); subir a R2 el `.wasm` nuevo de W10 |

En total, unas **38–74 semanas de trabajo** (≈ 9–17 meses), con la etapa 4 en paralelo con la etapa 2; 48–91 (≈ 11–21 meses) si todo va en fila. La etapa 4 va solo si los pilotos de la etapa 0 pasan: sin ella, el total baja a lo que suman las demás.

### Lo ya hecho (versiones 1–3)

Los pasos de las versiones 1–3, con su número de entonces y solo lo que quedó cerrado en ellos: lo hecho (con su fecha y dónde se documentó) y lo descartado (con el porqué). Lo que seguía abierto pasó a una etapa de la versión 4. Los pasos 8 y 9 no aparecen: no tenían nada cerrado y van enteros en la etapa 1. Los criterios de «Listo cuando» que seguían abiertos quedan descartados con la etapa que los reemplaza; los que estaban en curso siguen en curso. Al final va la poda del 2026-10-31 (el paso 17): lo que se sacó de las etapas de la versión 4 porque no rinde o no hace falta para la meta.

| Paso viejo | Qué | Ítems que quedaron aquí (hechos o descartados) | Duró (estimado entonces) |
|---|---|---|---|
| 1 | **Medir: los cuadros de lógica y la tarjeta por pasada.** Saber de verdad qué frena (la CPU o la tarjeta, y qué pasada) antes de tocar nada. | V5, V4, G8, V1 | 1 semana |
| 2 | **El aparato de mentira y el presupuesto por pieza.** Poder medir la gama media y la baja con este PC. | H1, H2 | 1 semana |
| 3 | **El impuesto del navegador, la línea base y las metas.** La foto de partida de los seis escalones, y cuánto cuesta el navegador. (N2, la escalera, pasó a la etapa 0.) | N1, N13, V2, V3, R5, R6, U3, E4, E5 | 1 semana |
| 4 | **Que nada se trabe al cargar.** Lo urgente y barato, casi todo en la página: el PC y Chrome dejan de congelarse al cargar. | C1, C4, C6, C7, C8, C10, D2, D6, D13, U1 | 2–4 días |
| 5 | **Nada se baja durante la carrera.** El paquete de carrera bajado antes de la cuenta, y una versión por archivo. (D7 y D14, el dominio propio y el tope diario del Worker, pasaron a la etapa 6.) | D1, D3, D4, D5, D8, D9, D12, U2, C2, C3, C5 | 1–2 semanas |
| 6 | **El motor: el código traducido y la memoria de la Wii.** Lo que más cuesta en wasm en la carrera: el código que genera el traductor (~70 % del impuesto) y la memoria de la Wii (~17 %). (N15, la subida a la v0.9.3, quedó hecha con nuestra aurora y es la base del motor; la aurora nueva, N15b, se descartó en la poda; H6, H7, M6, M7 y H11, a la etapa 2.) | M8, M1, M2, N15 | 6–9 semanas |
| 7 | **Lo caliente reescrito con IA, y no volver a subir lo que no cambia.** La IA reescribió las funciones calientes con un comprobador (0 diferencias, pero sin ganancia: el impuesto está repartido), y la pista quieta dejó de subirse a la tarjeta en cada imagen. | N14, G3, H12 | 3–5 semanas |
| 10 | **La tarjeta del teléfono, primera tanda.** Se creía que el Oppo se veía a 30 por la tarjeta (§115); el informe del 2026-10-30 dio la tarjeta en ~3 ms y en este PC la tarjeta, con sus marcas en el tramo fijo, no frena en ningún escalón (§164). La versión 4 lo cerró: lo que queda del dibujo va por el renderizador propio (W15, W16). | N9, G5, G2, G7, G10, H13 | 4–6 semanas |
| 11 | **La sala asíncrona.** Que el fps de uno no frene a los demás. | R3, R2, G1, R1, R7, R9 | 2–3 semanas |
| 12 | **La página liviana.** La página y el sitio fuera del cuadro del juego. (P1, P2 y U4 pasaron a la etapa 6; R4, a la 5.) | P3, P4, P6, P7, P8, R8, R10, E3, E6, C9 | 1 semana |
| 13 | **El motor: las cuentas.** El despacho, la multiplicación-suma, las cuentas de a dos y las esperas de más. La versión 4 lo descartó entero: pesan poco o agrandan el código (`docs/techo-pasos.md` §5). (P5 pasó a la etapa 6 y D10 a la 1.) | M3, M5, H8, H9, M4, M10 | 3–4 semanas |
| 14 | **El motor: lo visual en paralelo.** Partículas, animación y 2D a los ayudantes. La versión 4 lo reemplazó por el dibujo en otro núcleo (W10, W11) y las islas (W16–W18). (M11 pasó a la etapa 2.) | N5, N6, H10, N7 | 3–4 semanas |
| 15 | **Gráficos, segunda tanda: texturas, interpolación y calor.** Las texturas comprimidas quedaron como opción y el ubershader se descartó. (N8 pasó a la etapa 3; E1 y E2, a la 6.) | G6, G4 | 2–4 semanas, en paralelo con el motor |
| 16 | **La puerta B y la prueba final.** La app nativa quedó descartada (el producto es siempre la página). (N11 pasó a la etapa 5; N12, V6 y V7, a la 6.) | N10 | 2–4 semanas |
| 17 | **La poda del 2026-10-31: lo que no rinde o no hace falta.** El dueño (2026-10-31 23:10): «descarta todo lo que no rinda y no sea necesario para nuestro objetivo». Se revisó cada ítem abierto contra las metas por escalón (PC típico y portátil, 60 dibujados; teléfono de gama media, 60 dibujados; gama baja, 60 de carrera con 30 dibujados y la imagen intermedia, y en la sala el video desde un PC) y se quedó solo con lo que gana ~2 % o más del hilo del juego en la gama media o baja, lo que otro ítem necesita para medirse, y los arreglos que un jugador sí notaría. Salieron los hilos con memoria compartida y la CPU con la tarjeta en paralelo (la tarjeta no frena, y W10 ya lleva el dibujo a otro núcleo), lo de la página que con el juego en un Worker ya no toca el cuadro de la carrera, los avisos que no ganan cuadros, la aurora nueva y la infraestructura del Worker, que no es rendimiento. Cada uno con su porqué en «Avance». | H3, H4, N4, G9, P9, N15b, M9, D11, D10, M11, W18, P1, P2, U4, E1, E2, D7, D14 | una revisión, sin trabajo |

## Avance

Las casillas las marco yo a medida que avanzo: cada ítem terminado lleva la fecha y la hora y dónde quedó documentado (la bitácora o el commit), y cada etapa, sus criterios de «Listo cuando» medidos. «En curso» es lo que estoy haciendo y «descartado», lo que se decidió no hacer (con el porqué y el documento que lo decidió). Primero van las etapas de la versión 4; debajo, los pasos viejos, como historia. Lo mismo queda en `PLAN.md`, como siempre.

**152 de 152 ítems cerrados** (100 %): 92 hechos y 60 descartados · **2 de 11 etapas de la versión 4 cerradas** · 13 de 15 pasos viejos cerrados.

### Paso E0. Etapa 0 — Pilotos que deciden (12/12)

- [x] **W1** · M0: contar las páginas que ensucia la carrera y probar que el dibujo es un sumidero — hecho 2026-11-01 20:45 · bitácora §196: el dibujo es un sumidero en la carrera (6 pistas, huellas 40–44 de 40–44 deshaciendo lo que escribe el dibujo; 2 Contrarrelojes cuadro por cuadro); la carrera cambia 1,5–2,0 MB por cuadro (máx 35–42 MB al cargar): W10 sigue, foto por diferencias; en los menús no es un sumidero
- [x] ~~**W2** · Piloto: la colisión con la pista (KCL) como isla decompilada~~ — descartado 2026-11-01 17:15 · bitácora §199, matado: correcta (400.000 llamadas, 0 distintas; sala 15/0, fantasmas 6/0 y 6/0) pero ×0,95 en la función y ×1,002 en el cuadro (corte ×1,4); una isla transformada de la traducción no gana: lo que ahorra en lecturas lo pierde en el borde
- [x] ~~**W3** · Piloto: un modelo de la pista dibujado en nativo~~ — descartado 2026-11-01 22:15 · bitácora §200, matado: aunque la pista no costara nada (escondida antes de cada dibujo), este PC +0,8 % y la gama baja +4,3 % (3 pares), CPU por imagen 13,27 → 13,63 ms: lo caro del dibujo no es la pista; no empezar W15 por ella, medir antes el techo de karts, objetos y efectos
- [x] ~~**W4** · Piloto de PGO: compilar guiado por un perfil del programa nativo~~ — descartado 2026-11-01 21:25 · bitácora §198, zona gris: la misma carrera, el .wasm −8,3 %, pero en 6 vueltas intercaladas la gama baja gana +2,2 % (corte 2 %, éxito 5 %), este PC +3,2 %, Node ×0,998; rehacer el perfil con cada cambio del motor no paga: no se adopta, M6 no entra completo; la herramienta queda (tanda-w4.sh, profraw-v11.mjs)
- [x] **W5** · La simulación del teléfono paga la revisión de límites de Android — hecho 2026-11-01 14:50 · bitácora §194: con la revisión de límites de Android la gama baja simulada 21,7 → 16,8 cuadros de lógica/s (−23 %), la media −6,8 %, este PC −6,0 %, Node +21 %; desde ahora el teléfono simulado se mide con --wasm-enforce-bounds-checks
- [x] **W6** · Dos medidas del programa nativo en la carrera: dar vuelta los bytes y la memoria revisada — hecho 2026-11-01 16:40 · bitácora §197: en la carrera, bytes como wasm +23,5 % y tabla de páginas +43,1 % del nativo (5 vueltas ±1,7 %): juntas el 67 % (> 30 %), H6 y H7 van primero en la etapa 2; la parte cara de H7 no se corta
- [x] **N2** · La escalera de aparatos: medir donde juegan los demás y fijar la meta de cada escalón — hecho 2026-11-08 14:45 · bitácora §159–§164, §201 y §245: con el final de hoy (build/web-e6-w29) en cuadros de lógica/s: este PC 167 (×2,78), PC típico 105 (×1,75), el teléfono del dueño simulado (lastre 1,7 + límites) 123 (×2,05), portátil 49,8 (le falta ×1,20), gama media 34,0 (×1,76), gama baja 24,1 (×2,49); frena la CPU en todos; la meta es 60 en todos (el dueño, §114.6). Falta en el teléfono (lo hace el dueño al final): la escalera en el Oppo de verdad, sobre todo la tarjeta
- [x] **W7** · Las escrituras parciales de las matrices XF — hecho 2026-11-01 19:00 · bitácora §202, no hace falta: 0 avisos «sub-copy unsupported» en 5 pistas enteras (Nintendo y RR); el arreglo de KartPad 998c456 no se trae
- [x] **W8** · Los pipelines que no se sueltan en una copa entera — hecho 2026-11-02 00:30 · bitácora §203: en 8 pistas en una pestaña el proceso de la tarjeta crece +1,07 a +1,14 GB y son los sombreadores que aurora nunca suelta (no las texturas ni los pipelines: soltar 413 pipelines dejó +1.132 MB); ?soltarPipelines=2 (pipelines de las otras pistas + la memoria de sombreadores) la deja en −132 a −168 MB, con los mismos armados en el momento y +37 % de dibujos saltados al cargar cada pista nueva; queda apagado: prenderlo con W10 en el teléfono y la sala tras medir en qué etapa caen esos saltos
- [x] **W9** · Personajes invisibles en tarjetas Adreno 6xx/7xx: el chequeo — hecho 2026-11-01 23:37 · bitácora §205: el aviso de las Adreno 6xx/7xx en el registro y el informe (adreno.mjs, banco adreno 11) y el camino de reserva apagado (?huesosFilas=1: las matrices de los huesos por filas); la foto del mismo cuadro de la Contrarreloj, 0,000 % de píxeles distintos (cuadros 600 y 1500, el control también 0,000 %), sin errores WGSL, prueba-navegador 21/0; se prende para las Adreno con el primer informe
- [x] **W19** · El índice del memo de las llamadas indirectas (el arreglo `20ad85d` de KartPad) — hecho 2026-11-01 15:55 · bitácora §195: el memo con los bits altos (KartPad 20ad85d); huellas 75/75, fantasmas 6/0, paridad 28/0; gama baja +4,2 % (ruido ±5 %), este PC +0,5 %, Node ×0,989; build/web-w19 = la base de la etapa 0
- [x] ~~**W20** · Soltar las texturas de copia que nadie usa (la mitad de `0cca4d2` de KartPad)~~ — descartado 2026-11-01 19:10 · bitácora §204, no rinde: la piscina de copias pesa ~6 MB; soltando las ociosas (28) la tarjeta crece igual (+1.128 MB en 8 pistas); queda apagado (?piscina=1)
- [x] Listo cuando: cada piloto con su número y su veredicto (pasa o se mata, según su umbral) escrito en la bitácora — hecho 2026-11-02 00:30 · bitácora §194–§206: cada piloto con su número y su veredicto (hechos W5, W19, W6, W1, N2, W9, W8; matados W2 y W3; W4 zona gris; W20 no rinde; W7 no hace falta); el resumen en §206
- [x] Listo cuando: el sumidero probado en 5–10 pistas (también de RR) y las páginas sucias por cuadro medidas — hecho 2026-11-01 20:45 · bitácora §196: el sumidero en 6 pistas (4 de RR) y 2 fantasmas; 1,5–2 MB de páginas sucias por cuadro con la carrera andando
- [x] Listo cuando: la escalera de los teléfonos simulados medida otra vez con la revisión de límites de Android — hecho 2026-11-01 19:30 · bitácora §201: la escalera con la revisión de límites (media 30,6, baja 18,7 cuadros de lógica/s)
- [x] Listo cuando: los tres arreglos de KartPad revisados: el aviso de XF contado, la memoria tras 8 pistas medida y la tarjeta en el informe — hecho 2026-11-02 00:30 · bitácora §202, §203, §205: XF 0 avisos en 5 pistas; la memoria tras 8 pistas medida y explicada (los sombreadores; el modo 2 la deja plana); la tarjeta (Adreno) en el registro y el informe

### Paso E1. Etapa 1 — El dibujo en otro núcleo (5/5)

- [x] ~~**W10** · A1-s: el dibujo y la presentación en un segundo Worker, sin memoria compartida~~ — descartado 2026-11-08 20:40 · bitácora §247 (parte B): el par (A sin dibujar, B dibujando) en el tramo fijo es más lento en todo: gama baja 13,7–15,4 contra 48,8–52,9 cuadros de lógica/s (−71 %, 2 pares), «Oppo» −41 %, este PC −60 %; marcar las escrituras y armar la caja triplica el trabajo de A (5,6 → 19,6 ms en la gama baja), más de lo que ahorra no dibujar, y eso con B dibujando a medias (la 3D en negro a ratos, causa sin hallar). Queda como instrumento apagado (MKW_W10_COMPILAR=1)
- [x] **W11** · A2: lo que solo se ve de la parte de calcular, también al Worker del dibujo — hecho 2026-11-02 07:30 · bitácora §209: efectos (Effects::Mgr::Update), qué suena (SimpleAudioMgr::Calc) y el hilo de sonido son sumideros: con cada uno saltado, huellas 75/75 y el fantasma igual cuadro por cuadro; los tres juntos pesan +28 % en la gama baja y +7 % en este PC (?w11=7, dibujando cada cuadro); se mueven a B con W10; la interfaz 2D se queda (vive en SectionMgr::Update, que manda la carrera)
- [x] ~~**N3** · El juego en su propio proceso y fuera del hilo de la página~~ — descartado 2026-11-02 07:30 · bitácora §208.1, la puerta A: el juego entero en un Worker pierde −4,3 % en la gama baja (5 pares intercalados con la revisión de límites, 45,30 contra 47,33 cuadros de lógica/s, 4 de 5 peores) y empata en este PC: no pasa; la carrera se queda en la página y solo el dibujo va a un Worker (W10). El arnés (trabajador-juego.mjs) queda como instrumento y base del Worker del dibujo
- [x] ~~**P10** · Todo el juego en un Worker con OffscreenCanvas~~ — descartado 2026-11-02 07:30 · bitácora §208.2, no hace falta: con la puerta A cerrada (N3) la página real no tiene que hablar con un juego en un Worker; el arnés de §186 ya probó que se puede (huella igual) y lo que habría que pasar a mensajes está en §189 y docs/publicar.md §8
- [x] **H5** · Varios núcleos aunque el teléfono no dé memoria compartida — hecho 2026-11-02 07:30 · bitácora §208.3: el informe dice los hilos (aislar.mjs estadoHilos: aislada, memoria compartida, Chrome, Android, si DIP es esperable); banco aislamiento 16/16; teléfono simulado (prueba-aislamiento-telefono.mjs) 8/8; lo que publicaría el dueño en docs/publicar.md §8 (nada publicado). Sin memoria compartida la cinta de cajas anda en cualquier Chrome y W10 la usa
- [ ] Listo cuando: el hilo de la carrera a ~6 ms por cuadro en este PC (hoy 11,1), en el tramo fijo, y la gama baja simulada mejor en la misma proporción
- [ ] Listo cuando: huellas 75/75 con un programa nuevo y uno de hoy en la misma sala, el fantasma igual cuadro por cuadro y la foto igual
- [ ] Listo cuando: abrir el juego no atrasa más de 50 ms el latido de otra pestaña (lo que quedó abierto del paso 4 viejo)
- [ ] Listo cuando: la segunda copia del juego medida en memoria, y la puerta A decidida con números

### Paso E2. Etapa 2 — El motor (8/8)

- [x] **H6** · La memoria de la Wii en un lugar fijo: una cuenta en vez de una tabla — hecho 2026-11-02 13:50 · bitácora §211: la RAM de la Wii en una ventana fija de la memoria de wasm (MKW_MOTOR_FIJA, rama e2-h6, parches/motor-h6.diff, compilar-web.py --fija): gama baja con límites ~+29 % (20,3 contra 14,8–16,7 cuadros de lógica/s), este PC +2 a +7 %, Node ×0,838 y ×0,881 con límites; huellas 75/75, fantasmas 2.115/2.115, paridad 28/0, arranque 13/13; .wasm −3 %; memoria física igual (la reservada +223 MB por el hueco que nadie toca)
- [x] ~~**H7** · La RAM de la Wii guardada ya dada vuelta: sin invertir bytes en cada lectura~~ — descartado 2026-11-02 14:50 · bitácora §212: el techo medido (dar vuelta 2 y 4 bytes tres veces, MKW_H7_TECHO): una vuelta ≈ 8–10 % del cuadro (Node ×1,165 por dos vueltas, ×1,202 con límites); menos el «o exclusivo» de 1–2 bytes y las copias para aurora/sonido, ~×1,04–1,06 contra 3–5 semanas que tocan dibujo, sonido, NAND y página; VUELTA32 (SIMD) tampoco gana (×0,986, ×1,064 con límites)
- [x] ~~**M6** · Compilar guiado por un perfil (PGO)~~ — descartado 2026-11-02 15:00 · bitácora §213: se decide con la medida de W4 (§198), sin repetirla: gama baja +2,2 % (zona gris, ruido ±5 %), este PC +3,2 %, Node ×0,998, .wasm −8,3 %; H6 no cambia lo que PGO ordena (las ramas calientes) y el perfil se ata a la forma de cada función (rehacerlo con cada cambio del motor, lleva nombres del juego): queda como último paso opcional del programa para publicar (tanda-w4.sh lista)
- [x] **M7** · ThinLTO del runtime y aurora — hecho 2026-11-02 18:30 · bitácora §213: ThinLTO del runtime, aurora y lo propio de la página (MKW_LTO en compilar-web.py): gama baja con límites +8,6 % de mediana en 7 pares (5 a favor), este PC −1,4 %; huellas 75/75, fantasmas 2.113/2.113, arranque 13/13; .wasm +0,5 %
- [x] ~~**H11** · Código caliente junto y chico: los teléfonos tienen cachés chicas~~ — descartado 2026-11-02 19:50 · bitácora §214: las 30.426 funciones traducidas que no corren en 3 carreras (perfil de V8 en Node, h11-caliente.mjs → frio.h) compiladas con minsize y cold (compilar-web.py --frio): .wasm −5,0 %, huellas 74/74, fantasmas 2.113/2.113, arranque 13/13; Chrome gama baja con límites 4 pares −0,2/−5,3/+2,2/−2,6 % (mediana −1,4 %), este PC +0,3 %, Node ×1,034: no gana (V8 solo optimiza lo caliente; lo frío no pasa por la caché en la carrera)
- [x] ~~**W12** · La pila de la Wii en variables locales~~ — descartado 2026-11-02 22:20 · bitácora §215: el techo (cada uno de los 238.412 accesos a la pila r1+k hecho DOS veces, herramientas/w12/techo.py + pila-doble.h): Chrome gama baja con límites 0 / −11,7 / +3,5 % en 3 pares (mediana ≈ 0), este PC −4,7 / +1,4 / +1,4 %, Node ×1,011 (con límites ×1,14–1,23 en 2 vueltas); arranque 13/13. Si hacerlos dos veces no cuesta, sacarlos no gana: no valen 3–4 semanas de traductor. El 4.º par quedó a medias (pausa del dueño)
- [x] ~~**W13** · El contexto de la CPU en una dirección fija~~ — descartado 2026-11-03 10:50 · bitácora §216: el techo (cada uno de los 4.306.008 accesos al contexto ctx->… hecho DOS veces, herramientas/w13/techo.py + ctx-doble.h): Chrome gama baja con límites −10,8 / +4,3 % (pares contradictorios), este PC −2,6 / −10,4 %; arranque 13/13. W13 no saca accesos, solo les quita la revisión de límites: gana una fracción chica de ese techo contra 1–2 semanas y el riesgo de los contextos de interrupción y las fibras
- [x] ~~**W14** · Las banderas del CR «perezosas», y terminar el modo seguro de §193~~ — descartado 2026-11-03 14:30 · bitácora §217: el techo de §193 bien medido (rearmado con la página de hoy y &dibujarSiempre=1): gama baja +11,6/+17,7 %, este PC −9,2/−11,3 %; el modo seguro terminado (destinos de las indirectas 14.303, operaciones del CR exactas, phi y saltos indirectos; herramientas/w14/banderas.py; parches/traductor-w14.diff) deja U = 0xFF: ~180 posibles destinos leen el CR entero de verdad (mfcr), y bajarlo exige la regla de la Wii que RR no cumple. No pasa la regla de E2 ni en su techo (pierde ~10 % en este PC)
- [ ] Listo cuando: `paridad`, el volcado de la RAM, la huella ampliada y los fantasmas iguales en cada cambio
- [ ] Listo cuando: el código traducido ×1,3 o más rápido en la gama baja simulada (con la revisión de límites), en el tramo fijo
- [ ] Listo cuando: `correr-todo` completo con el programa final

### Paso E3. Etapa 3 — Simular a 60, dibujar a 30 y mostrar 60 (1/1)

- [x] **N8** · Simular a 60, dibujar a 30 y mostrar 60: la interpolación de aurora — hecho 2026-11-04 05:50 · bitácora §219 (resumen de E3 en §221): en la carrera el juego dibuja uno de cada dos cuadros y aurora muestra la imagen del medio; opcional y apagado por omisión (decisión del dueño 2026-11-02): ?n8=1|2|auto y Gráficos «Dibujar a 30 y mostrar 60»; la misma carrera (fantasmas 2.117/2.117, sala 74=74); gama baja +30–47 % de lógica/s; un cuadro más de demora (16,3 ms); no sirve si frena la tarjeta (la vigía lo prueba y lo apaga)
- [ ] Listo cuando: la gama media y la baja simuladas: 60 cuadros de lógica por segundo y 60 imágenes a la vista (30 dibujadas y 30 intermedias), con la huella igual
- [ ] Listo cuando: en la sala, uno dibujando a 30 y otro a 60: huellas 75/75

### Paso E4. Etapa 4 — Las islas decompiladas (3/3)

- [x] ~~**W15** · D-a: el envío del dibujo en nativo (el renderizador WebGPU propio, primer nivel)~~ — descartado 2026-11-04 08:30 · bitácora §222, baja de prioridad frente a W10 (no se construye): el techo de dibujar en nativo, medido escondiendo cada grupo solo mientras se dibuja (tramo fijo, &dibujarSiempre=1, gama baja con límites): karts +0,6/+1,6 %, objetos −2,6/−3,2 %, pista −1,8/−2,4 %, efectos +3,0/−0,5 %, TODO junto +3,7/+2,2 % (este PC −2,4/+3,2 %): ningún grupo pasa el 5 %. Lo caro del dibujo (~10 ms de ~20 en la gama baja, por N8) es el esqueleto del cuadro, no los modelos (−0,7 ms con 178 escondidos)
- [x] ~~**W16** · D-b: el dibujo entero en nativo~~ — descartado 2026-11-04 08:30 · bitácora §222, baja de prioridad frente a W10 (no se construye): mismo techo que W15; el dibujo entero de los modelos y los efectos en nativo ahorraría como mucho +2,9 % en la gama baja
- [x] ~~**W17** · Las islas de la lógica: la colisión y la física del kart~~ — descartado 2026-11-04 08:30 · bitácora §222.3, descartado con la estimación: la física y la colisión de los karts ≈ 33–40 % de la lógica ≈ 17 % del cuadro de la gama baja; una versión propia a ×1,3 daría ≈ +4 % (×1,4: +5 %, solo reescribiendo exactas ~1.900 funciones; la colisión sola < 1 %), más la copia de ida y vuelta de los 12 karts; W2 dio ×0,95: no pasa la puerta con margen
- [x] ~~Listo cuando: cada isla con 0 diferencias en su comprobador, los fantasmas iguales y la sala 75/75~~ — descartado 2026-11-04 08:30 · bitácora §222: no se construye ninguna isla (W15/W16 bajo el 5 %, W17 estimado ≈ +4 %)
- [x] ~~Listo cuando: el dibujo a 3 ms o menos de CPU por imagen en este PC (hoy ~6,7), con las fotos iguales~~ — descartado 2026-11-04 08:30 · bitácora §222: el dibujo de los modelos pesa ~0,7 ms de ~10 en la gama baja; el resto es el esqueleto del cuadro (a medir en E5, §222.4)
- [x] ~~Listo cuando: la gama media simulada con el hilo de la carrera a 16,7 ms o menos~~ — descartado 2026-11-04 08:30 · bitácora §222: ninguna isla pasa su techo; la gama media va por W10 y N8

### Paso E4b. Etapa 4b — Lo ambicioso: hilos de verdad, el dibujo retenido y los saltos en línea (4/4)

- [x] **W21** · Hilos de verdad: el sitio aislado con un service worker (COOP/COEP) — hecho 2026-11-05 00:45 · bitácora §225, el día 1 (solo en el sitio local, apagado por omisión): web/navegador/sw-aislar.js pone Document-Isolation-Policy al marco del juego con ?aislar=sw|sw-corp; prueba-aislar-sw.mjs 8/8 con las dos formas (aislado con memoria compartida, Juegos sin cambios, el token y lo privado del Worker, la carrera, el sonido). Solo no gana: tramo aislado −4,5 % este PC, −3,4 % gama baja (un par, dentro del ruido). Llevarlo al sitio = PR del dueño (pasar a mensajes mkwConectar*); los hilos de verdad = un programa con pthreads, semanas
- [x] ~~**W22** · El dibujo retenido: aurora rehecha para la web~~ — descartado 2026-11-05 00:15 · bitácora §224: el censo de las llamadas a WebGPU (censo-gpu.mjs, ?censoGpu=1): ~1.400–1.570 llamadas por imagen, 26 pasadas; codificar la imagen entera otra vez cuesta 0,17–0,19 ms de 10,7 (1,7 % del cuadro; con el paso wasm→JS, ≤ 3 %: ≤ 0,6 ms en la gama baja, bajo los 2 ms de la puerta); retenida como render bundles ~0,10 ms; solo la mitad de las órdenes se repite igual. El esqueleto está del lado de wasm (aurora armando su lista y el dibujo del juego), no en las llamadas: no se construye
- [x] ~~**W23** · Los saltos indirectos en línea: `call_ref` y la inline especulativa de V8~~ — descartado 2026-11-05 00:10 · bitácora §226: la prueba chica (2.000 funciones, WAT a mano): en Chrome 156 call_ref pierde contra call_indirect en los tres casos (+20 a +52 %; un destino 0,61 contra 0,80 ns, cuatro 2,83/3,90, muchos 15,1/18,3; igual con la revisión de límites). Chrome ya mete en línea call_indirect solo; Node 24 no (por eso parecía buena). No se toca el traductor
- [x] ~~**W24** · OPCIONAL: el teléfono solo dibuja y el PC de la sala calcula por él~~ — descartado 2026-11-05 02:15 · bitácora §227, piloto con puerta (el dueño: «solo si es que sirve»): matado por la puerta 1. La caja de W10 achicada para la red (resta XOR + código de ceros + deflate, w24-caja.mjs, 0 vueltas malas) pide 20–27 Mbit/s de subida por teléfono en 4 pistas (cruda 51–66; la puerta era ~3: falta ×7–9) y deflate cuesta 1,6–2,8 ms por cuadro en el PC; el dibujo solo estimado +30–85 % en la gama baja (pasaría) y la demora media ida y vuelta + ~33 ms (solo con ping < 34 ms). No se construye la opción; la parte B escrita y sin compilar en parches/w24-parte-b.diff
- [x] Listo cuando: el sitio local funciona entero con aislamiento y `crossOriginIsolated` es verdadero en el marco del juego (W21) — hecho 2026-11-05 00:45 · bitácora §225: el sitio local con el marco del juego aislado, crossOriginIsolated verdadero, 8/8
- [x] Listo cuando: el esqueleto medido por partes y, si se construye, el costo del dibujo por cuadro más bajo en la gama baja simulada (tramo fijo §163, con `--wasm-enforce-bounds-checks`) con la foto igual (W22) — hecho 2026-11-05 00:15 · bitácora §224: la parte de las llamadas a WebGPU medida por el censo (≤ 3 % del cuadro); no se construye el dibujo retenido
- [x] ~~Listo cuando: la prueba chica primero y después el juego, con huellas 75/75 y el fantasma igual (W23)~~ — descartado 2026-11-05 00:10 · bitácora §226: la prueba chica pierde en Chrome; no se sigue con el juego
- [ ] Listo cuando: cada pieza adoptada, medida en la gama baja simulada y en este PC, con las pruebas de igualdad completas

### Paso E4c. Etapa 4c — Las mejoras chicas, juntas (1/1)

- [x] **W25** · Las mejoras chicas, juntas: un paquete medido de una vez y PGO como sello — hecho 2026-11-05 06:10 · bitácora §228: el paquete de las chicas (C2 texturas BC1, C3 funciones calientes, C4 memo ×4, C7 wasm-opt -O3; C5/C6 del traductor sin hacer) no gana en 6 pares (gama baja −0,3 %, este PC −0,3 %) y no se adopta; PGO (§228.1: gama baja +7,5 % de media y +10,2 % de mediana, este PC +1,1 %, .wasm −8,9 %, la igualdad entera) lo adoptó la orquestadora y desde §228.2 compilar-web.py --final rehace o reusa el perfil solo (herramientas/pgo_final.py, los 3 guiones de herramientas/pgo/, la partida base; --sin-pgo = sin él): final 13/13, huellas 75/75, fantasmas iguales; subir el .wasm nuevo a R2 lo hace el dueño
- [ ] Listo cuando: cada pieza pasada a la base de E4b con su interruptor, y el paquete con arranque 13/13, sala 75/75, fantasma y foto iguales
- [ ] Listo cuando: el paquete medido contra la base en la gama baja simulada (tramo fijo §163, con `--wasm-enforce-bounds-checks`) y en este PC, decidido con la regla del paquete
- [ ] Listo cuando: PGO encima del paquete decidido, medido con la misma regla y con el perfil rehecho solo en `--final`

### Paso E5. Etapa 5 — Las salas (2/2)

- [x] ~~**N11** · Plan C2: el teléfono débil ve la carrera en video desde un PC de la sala~~ — descartado 2026-11-05 08:20 · bitácora §229, piloto con puerta: matado por la puerta 3 (y la 2b). A 720 con H.264 a 8 Mbit/s el video sale a 56–60 img/s, QP 27–29 (la 1 pasa raspando); la demora que agrega el video sin red, medida con la hora pintada en la imagen (n11-video.mjs, ?n11=8&n11Marca=1), es 56 ms de mediana y 87 de p90 (la vara: 50); la gama media simulada no llega a 60 a 720 ni sin la vista de más (12–14 img/s) y con el video le sale a 5–8 img/s. No se construye la opción; quedan el instrumento, &vistas=2 y tanda-n11.sh
- [x] **R4** · Lockstep sin basura por cuadro — hecho 2026-11-05 08:40 · bitácora §230: lockstep.mjs con anillos fijos con etiqueta, el paquete de botones en un búfer reusado y votos con contadores; igual byte a byte en 6 escenarios con reloj virtual (r4-igual.mjs) y el lockstep limpia 2–7 veces menos; con el juego, en Chrome la basura de la carrera no cambia (la hace el resto de la página), las huellas iguales, con el árbitro A espera 0 ms en las trabas y 3 carreras PC + teléfono de gama media con la huella ampliada igual
- [x] ~~Listo cuando: un teléfono de gama baja simulado ve la carrera a 60 por video desde un PC de la sala, con la demora del botón a la imagen medida~~ — descartado 2026-11-05 08:20 · bitácora §229.1: N11 matado por su puerta (el video agrega 56 ms de mediana y 87 de p90 sin la red; la gama media no llega a 60 a 720): no hay video desde un PC
- [ ] Listo cuando: una traba de 1,5 s de un jugador les cuesta menos de 20 ms a los demás, con el árbitro (`prueba-relevo --trabas=8`) — en curso 2026-11-05 08:40 · bitácora §230: con el árbitro, A no espera la traba de B (0 ms en 8 trabas, 3 de 4 corridas; la otra 321 ms una vez); C, con la red mala, espera a A ~90 ms de mediana y una vez ~500 en 1 de cada 2 corridas, igual con el lockstep de antes de R4: no se cumple para C
- [x] Listo cuando: en este PC, un Chrome normal y otro como teléfono (emulación y el lastre de gama media): 3 carreras con la huella ampliada igual — hecho 2026-11-05 08:30 · bitácora §230: un Chrome normal y otro con ventana de teléfono, ?comoTelefono=1 y el lastre de la gama media (17–22 cuadros/s), 3 carreras (0.0, 13.2, 30.2) con la huella ampliada igual (tanda-r4.sh telefono)

### Paso E5b. Etapa 5b — La sala: 3 conexiones (1/1)

- [x] **R11** · La sala con 3 conexiones: host en un jugador, host + repetidor Cloudflare, servidor Oracle — hecho 2026-11-08 13:40 · bitácora §241 (antes §236): banco arbitro-servidor 21/21 y con el juego tanda-conexion-sala host 13/13, Cloudflare 15/15 (los dos extremos por el repetidor), Oracle 14/14 (4.644 paquetes del árbitro Node local) y Oracle sin configurar 14/14 (vuelve al host), huellas iguales en todas; crear la máquina en Oracle, publicarla y el PR del vestíbulo son del dueño (docs/publicar-oracle.md)
- [ ] Listo cuando: las tres opciones en el vestíbulo con su texto
- [ ] Listo cuando: el servidor de mentira con huellas iguales, la vuelta al host y la traba de uno
- [ ] Listo cuando: `prueba-sincro --directa` en cada modo

### Paso E6. Etapa 6 — La página liviana y la prueba final (4/4)

- [x] **P5** · Sonido: búferes reciclados y una sola llamada por entrega — hecho 2026-11-07 14:10 · bitácora §237.14: búferes reciclados (315 mil reusados vs ~70 nuevos) y una llamada nativa por entrega; igualdad 13/13, fantasmas 6/6. Las limpiezas no bajan (65–131/min, igual que el viejo) pero duran < 0,22 % del minuto: no son del puente ni frenan; la meta estaba mal puesta
- [x] **N12** · Lo que no se puede, por física, y decirlo en la página — hecho 2026-11-07 00:46 · bitácora §237: aviso antes de largar comprobado en ambas páginas con el juego. Banco actualizado 27/27 en Chrome, con prioridad de lógica N8 y tarjeta lenta aunque la CPU esté libre
- [x] **V6** · Sesiones largas: 1 hora de sala y una copa entera en el teléfono — hecho 2026-11-07 14:10 · bitácora §237.14: 62 min y 20 carreras sin caídas, CPU estable; la copa con teléfono termina sin bloquear al anfitrión. Memoria de vídeo +1,36 GB/h (los sombreadores de §203): pasa a W26
- [x] **V7** · Una sala de 12 con lo que hay: varios Chrome y consolas de mentira — hecho 2026-11-07 14:10 · bitácora §237.14: Host con doce plazas, PC 59,3–60,0 y metas en las tres carreras, sin esperas > 50 ms en el minuto medido; el teléfono simulado flojo (lastre 3,5, tres juegos en un PC) sale sin frenar a nadie. El Oppo real ≈ lastre 1,7: repetir calibrado y en PC separados queda para después
- [ ] Listo cuando: casi ninguna limpieza de memoria en un minuto de carrera — en curso 2026-11-07 00:46 · bitácora §237: meta incumplida. Dos pares de 60 s; el puente nuevo da 67-68 limpiezas sumadas en PC y 117-131 en baja
- [ ] Listo cuando: cada escalón medido otra vez contra su meta de la versión 4 — en curso 2026-11-07 02:23 · bitácora §237.13: cinco escalones medidos sin N8. Portátil, media y baja quedan por debajo de 60 de lógica. Tope con referencia histórica. El dueño pausó el contraste con dibujo de sala antes de un par válido
- [ ] Listo cuando: la sala de 12 con su meta por escalón, sin esperas de más de 50 ms, y una hora de sala con la memoria plana — en curso 2026-11-07 02:15 · bitácora §237: memoria de vídeo +1364 MB/h en 62 min; la sala Host de doce falla el límite de espera, la igualdad y la meta del teléfono
- [ ] Listo cuando: `correr-todo` en verde — en curso 2026-11-07 00:46 · bitácora §237: planilla del candidato E6 con 658 bien y 22 mal en 9 pruebas; no está en verde

### Paso E7. Etapa 7 — El plan combinado: W10 primero, gráficos al final (15/15)

- [x] **W29** · Piloto chico: la memoria del wasm de tamaño fijo — hecho 2026-11-08 15:10 · bitácora §239 y §244: con 512 MB (sin H6) corre 11 pistas seguidas sin caerse (pico usado 278 MB, prueba-navegador 22/22); en el final (con la ventana de H6, pico 510 MB) el mismo margen son 768 MB: adoptada, compilar-web.py --final pone --memoria-fija 768 (--memoria-crece = como antes); build/web-e6-w29 contra web-e6: arranque 13/13, la sala 14/14 con huellas iguales, fantasmas 6/6; gama baja +7,7 % (6 pares, 6 de 6 a favor), este PC +2,3 %. Falta en el teléfono (lo hace el dueño al final): que Android no cuente la reserva; y correr-todo antes de subir
- [x] **W26** · La memoria durante horas: un conjunto acotado de pipelines — hecho 2026-11-08 23:10 · bitácora §248: 808 sombreadores salen de 712 textos WGSL (compartir el módulo: igual memoria, apagado); la memoria está en los sombreadores compilados; el conjunto acotado (?pistasGuardadas=K: solo se sueltan las pistas fuera de las últimas K, con ?soltarPipelines=2) deja la tarjeta con tope (pico 1,8 GB contra 2,3 y subiendo en 16 carreras) y una copa repetida salta como la base; prendido por omisión en el teléfono (4 pistas), el PC como antes; huellas 75/75 y fantasma igual. Falta la copa larga en el Oppo
- [x] **V8** · Repartir por partes los ~10 ms del lado CPU del dibujo (la tarjeta ya está medida) — hecho 2026-11-08 23:20 · bitácora §249: el dibujo es el 23 % de la CPU (~2,8 ms por imagen en este PC, ~9,7 en la gama baja): el código de dibujo del juego 38 %, aurora convirtiendo GX 18 %, WebGPU y pegamento 9 %, ayudantes 9 %, runtime GX 11 %, recetas 3,5 %; las listas de dibujo (tiempo incluido) 21 % (~2 ms, techo medido 0,6–0,7), el atajo de la última configuración ~0,3 ms. Ninguna pieza da los 3,3 ms: W27, W28 y G14 descartados
- [x] ~~**W27** · Reconstruir la preparación de cada imagen (escena persistente)~~ — descartado 2026-11-08 23:20 · bitácora §249 (V8): lo que no es del juego (aurora, runtime GX, WebGPU) es ~44 % del dibujo, ~4 ms por imagen en la gama baja (~2 por cuadro de lógica con N8); bajar 3,3 ms exigiría quitar casi todo, son meses y W22 (§224) ya mostró poco margen en las llamadas
- [x] ~~**W28** · Traducción de alto nivel de subsistemas enteros~~ — descartado 2026-11-08 23:20 · bitácora §249 (V8): tocaría el 38 % del dibujo (el código del juego) y la lógica, pero N14, W2, M8 y la FMA no ganaron, son muchos meses y exige igualdad bit a bit
- [x] **G11** · Gráficos opcionales: brillo, efectos de pantalla y sombras simples — hecho 2026-11-09 04:03 · bitácora §252: brillo, desenfoque de lo lejano, sombras por volumen y mapa de luz como casillas del jugador (Avanzado → Gráficos, todo prendido por omisión; ?quitarEfectos=N): con los cuatro apagados la tarjeta gasta −40 % en este PC y −30 % en la gama baja (0,99 → 0,65 ms por imagen), la CPU igual; la carrera la misma (sala 74/74, dos programas 74/74, fantasma 2113/2113, arranque 21/21). Falta en el Oppo: si el ahorro de la tarjeta alcanza
- [x] **G12** · Texturas bajísimas: reducidas al subirlas a la tarjeta — hecho 2026-11-09 04:46 · bitácora §253: las texturas a la mitad o a un cuarto como opción (Avanzado → Gráficos «Texturas», completas por omisión; ?texturasMenos=0|1|2): aurora salta los niveles de detalle más grandes que el juego ya trae (parches/aurora-g12.diff). Un cuarto: texturas 106 → 65 MB tras 4 pistas (−39 %), total −128 MB; la velocidad en este PC y en la gama baja simulada no cambia (ruido); la carrera la misma (sala 75/75, dos programas 74/74, fantasma 2116/2116, arranque 21/21). Falta en el Oppo: si baja el tarjeta ms y si la pestaña aguanta más pistas
- [x] **G13** · Menos partículas y el preajuste «Liviano» — hecho 2026-11-09 04:54 · bitácora §254: la casilla «Partículas» (no se dibuja Effects::Mgr, el cálculo sigue; ?quitarEfectos=16) y los botones «⚡ Liviano» (efectos de G11 apagados, texturas a la mitad, salida 540) y «↺ Todo como venía», todo como siempre por omisión. Sin partículas: CPU por imagen −4 % en este PC, −9 % de promedio en la gama baja (4 pares); Liviano: tarjeta −30 % en la gama baja; la carrera la misma (sala 74/74 y 75/75, al revés 74/74, fantasma 2115/2115, prueba-celular 41/41). Falta en el Oppo: Liviano y el tarjeta ms
- [x] ~~**G14** · Modelos low poly, simplificados en la página al cargar~~ — descartado 2026-11-08 23:20 · bitácora §249 (V8): los vértices pesan poco en la CPU (ApplyAuroraVtxAttrFmt, GXSetVtxDesc, el armado de cada dibujo) y la tarjeta no frena: simplificar las mallas no tiene dónde ganar
- [x] **G15** · Elegir cómo se muestra la imagen en pleno juego: 30 parejas, 60 o con imagen intermedia — hecho 2026-11-09 12:20 · bitácora §255: «Imagen» en Avanzado → Gráficos (Automático por omisión, 30 parejas, 60, con imagen intermedia) se aplica en el momento, sin reiniciar: el juego cambia el modo de N8 solo en el borde de un par de cuadros (n8_nativo.cpp aplicarPedido; window.mkwImagen; ?imagenCiclo=S para probar). 21 cambios en una carrera: 0 fotos negras, 0 de 290 imágenes de verdad tiradas, lógica 60,0; sala A 30 parejas / B intermedia 75/75 y B cambiando cada 3 s 74/74; medir-enlinea: 25 / 12,6 / 12,7 % de refrescos con cuadro nuevo a ~238 Hz, 0 saltados. Falta en el teléfono: elegir 30 parejas a mano
- [x] **G16** · El 1 % más bajo casi igual a los fps a la vista: medirlo y vigilarlo — hecho 2026-11-09 17:20 · bitácora §256: el 1 % y el 0,1 % bajo de las imágenes (de entrega a entrega, imagenes-vista.mjs) en medir-sitio, medir-enlinea y tiempos-cuadro, y en vivo en el medidor (Gráficos «Gráfico del tiempo de cada imagen»). La causa en la sala: el temporizador despertaba 0–7 ms tarde; ahora despierta 3 ms antes y cede hasta el vencimiento (?despertarAntes=0 = antes): a 60 a 240 Hz imágenes desparejas 5,2 → 1,2 %, 1 % bajo 87 → 90 %; 30 parejas 92 → 94 %; la intermedia 75 % (C++ propuesto); la gama baja limitada por la CPU, sin costo. Sala 74/74. Falta en el teléfono
- [x] **G16b** · La imagen intermedia de N8, pareja — hecho 2026-11-09 19:40 · bitácora §260: la imagen intermedia de N8 pareja. La toma se anota cuando aurora pide la textura y el compás no se queda en el borde de un refresco (?margenToma=0 = antes): intermedia a 240 Hz, imágenes de 4 refrescos 50–64 → 92–97 %; a 60 el 1 % bajo 89 → 92 %; gama baja sin costo; sala idéntica. Falta en el teléfono
- [x] **W30** · Igual entre nosotros, no igual a la Wii: las cuentas del procesador con las del navegador — hecho 2026-11-09 13:57 · bitácora §257, adoptado: la FMA, el NI del FPSCR y el redondeo de C a 25 bits con las cuentas de wasm, deterministas en todos los aparatos (terceros/Wiicompiled-motor-w30, MKW_MOTOR_W30=7 por omisión; las banderas CR no, §217). Chrome tramo fijo: gama baja +7,1 / +3,4 %, este PC +5,9 / +7,7 % (2 pares, zona gris; el dueño decidió no correr más); Node ×0,84; .wasm −5 MB. La sala igual (prueba-sincro 15/0, huellas 74/74; prueba-sala 44/0). El fantasma del experto: se separa en el cuadro 293 en 1 ulp, como mucho 1,2·10⁻⁵ vueltas antes de la meta, la cruza en el mismo cuadro (2242). Falta: juntarlo al programa final con PGO, correr-todo y publicar
- [x] ~~**W31** · Guardar la traducción de las listas de dibujo y los render bundles de WebGPU~~ — descartado 2026-11-09 19:15 · bitácora §259, descartado por su techo: traducir las listas de dibujo es 0,48 ms por imagen en este PC (4,7 %) y 1,48 en la gama baja (~7 %); reconocerlas con huellas cuesta 0,39 / 1,17 ms; solo el 3,5 % de las listas son de objetos quietos (la cámara se mueve: guardar matrices no gana). El techo en Chrome (ningún dibujo de las listas, sin imagen) da +4,4 % en la gama baja (+0,1/+7,9/+5,2) y ~+4 % en este PC (+13,4/−5,3), bajo el +8 %; los render bundles ya medían −0,08 ms (W22, §224). Instrumento ?w31=contar|todas|quietos en terceros/aurora-w31 (parches/aurora-w31.diff), herramientas/tanda-w31.sh
- [x] ~~**W32** · Evaluar: la IA de las CPU piensa cada 2 cuadros (la física sigue a 60)~~ — descartado 2026-11-09 17:33 · bitácora §258: la IA de las CPU 1 de cada 2 (o 3) cuadros, en un programa aparte (MKW_IA30_COMPILAR=1, ?ia30=2|3). La IA pesa el 6,3 % de la lógica; la sala igual (huellas 75/75 con 2 y con 3); pero las CPU manejan mucho peor: recorren −17,4 % (ruido +0,8 ± 0,5), la ganadora +19 %, tropiezos 36 → 83 y caídas 8 → 23 por carrera, Máximo más fácil; la ganancia (−2,5 a +11 %) no se distingue del ruido. El dueño: «ok no apliquez esto entonces, se ve claro que sufre mucho la cpu»
- [ ] Listo cuando: W10 medido en la gama baja y en este PC
- [ ] Listo cuando: una hora de sala con la memoria plana
- [ ] Listo cuando: el lado CPU del dibujo repartido por partes

### Lo ya hecho (versiones 1–3)

#### Paso 1. Medir: los cuadros de lógica y la tarjeta por pasada (4/4)

- [x] **V5** · Contar los cuadros de lógica, no solo los dibujados — hecho 2026-10-27 21:23 · bitácora §124 (en la carrera, sin recompilar)
- [x] **V4** · Contadores por cuadro dentro del motor — hecho 2026-10-28 01:02 · bitácora §152: programa aparte con contadores; ~1,1 M accesos a la memoria por cuadro, 0 lentos; la FMA de pares no la ve
- [x] **G8** · El medidor de GPU no puede inflar lo que mide — hecho 2026-10-27 21:21 · bitácora §123
- [x] **V1** · En el teléfono: separar el juego, la espera y la tarjeta de video — hecho 2026-10-31 21:40 · bitácora §173 y §177.4: en la página ya está todo (CPU pura sin esperas, el tramo de la tarjeta por pasada, «Mostrar qué frena»); el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] ~~Listo cuando: el informe separa juego, espera y tarjeta, y da el tiempo de cada pasada (en este PC y con el aparato de mentira)~~ — descartado 2026-10-31 22:30 · versión 4: V1 ya lo da en la página (hecho); con la revisión de límites de Android, en la etapa 0 (W5)
- [x] Listo cuando: se sabe cuántos cuadros de lógica corre un jugador por segundo — hecho 2026-10-31 10:09 · bitácora §124 (V5): los cuadros de lógica de la carrera (Raceinfo +0x1C/+0x20) en el medidor y en el informe, `mkwEstado.logica`; con el tramo fijo de §163, cuántos por segundo

#### Paso 2. El aparato de mentira y el presupuesto por pieza (2/2)

- [x] **H1** · El aparato de mentira: la gama media y la baja simuladas en el PC — hecho 2026-10-31 21:40 · bitácora §155 y §166: el aparato de mentira entero en este PC (?lastre, ?lastreAyuda, ?ladron, ?lastreGpu; banco lastre 15/15), calibrado en el tramo fijo (§163, §164); lastreGpu queda con la calibración de §164; el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] **H2** · El presupuesto de la gama media: una meta en ms para cada pieza — hecho 2026-10-31 21:40 · bitácora §149 y §166: el presupuesto en el informe (la página), cada pieza contra su meta; se comprueba en este PC con el aparato de mentira (H1) y el tramo fijo (§163); el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] Listo cuando: con K = 1, 2 y 4 el cuadro crece 1, 2 y 4 veces — hecho 2026-10-29 16:25 · bitácora §155: banco lastre (CPU ×2,00/×3,99, tarjeta ×2,08/×4,05) y K = 2 en la carrera ×1,98
- [x] Listo cuando: el informe muestra cada pieza contra su meta — hecho 2026-10-28 01:02 · bitácora §149: presupuesto() en el informe, cada pieza contra su meta

#### Paso 3. El impuesto del navegador, la línea base y las metas (9/9)

- [x] **N1** · Medir el impuesto del navegador: el mismo juego nativo contra el del navegador — hecho 2026-10-28 01:02 · bitácora §153: el mismo juego nativo contra wasm, ×2,2 (memoria ~30 %, FMA ~0, resto ~70 %); escena del título, sin dibujo
- [x] **N13** · Abrir el impuesto: dónde se va el 70 % que no es la memoria, y el impuesto en la carrera — hecho 2026-10-30 03:00 · bitácora §160, §165 y §166: en el título ×3,4 de CPU (salir del wasm 30 %); en la carrera de 12 (tramo 600–2400) ×2,63 de pared en 25 pares intercalados (nativo 2,01 · wasm 5,57 ms por cuadro de lógica; medir-node-estable.mjs) y ×2,45 por función: código traducido 63,7 % + RR 6,3 %, memoria 16,6 %, salir del wasm 6,4 %, despacho 3,3 % (las llamadas indirectas ≤3,5 %), otros 2,6 %, sin explicar 2 %; sin vectorizar +16 %; el (program) de Chrome 7,9–16 %, con las idas y vueltas de JSPI ~7 ms/s (4,8 µs cada una); con tope este PC 11 ms de CPU por imagen (lógica 4,4 + dibujo 6,7); el traductor pasa al paso 11
- [x] **V2** · Medir el arranque como lo sufre un amigo (tareas largas, CPU y memoria por proceso) — hecho 2026-10-29 16:17 · bitácora §151 y §156: corridas con --arranque en 16, 8 y 4 lógicos y a 20 Mbit/s; con 2C/4T otra pestaña se atrasaba hasta 317 ms, pero era la medida (§158: la página creía tener 16 núcleos; con el tope de verdad 1 traba de ~300 ms al largar, por TurboFan, criterio del paso 4 abierto); la pareja de D3 no gana
- [x] **V3** · Medir una carrera completa, de la cuenta a la meta — hecho 2026-10-28 01:02 · bitácora §150: 3 pistas enteras; en carrera 2 archivos, 0 esperas a la red; sin la música de la última vuelta (solo CPU)
- [x] **R5** · Huella ampliada: saber qué se separó y cuándo — hecho 2026-10-28 01:02 · bitácora §154: cada 30 cuadros, 12 karts + azar con volcado; sin posición/velocidad/objetos (punteros sin verificar)
- [x] **R6** · PC y celular en la misma sala: probar que den la misma carrera — hecho 2026-10-31 21:40 · bitácora §177.3: en este PC, B con otra ventana, fluidez, escala o aspecto libre = la misma carrera (5 casos, 13/13); el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] **U3** · Contrarreloj como prueba barata para separar causas — hecho 2026-10-31 21:40 · bitácora §157: en este PC Contrarreloj 4,9 ms de CPU pura contra 6,6 con 12 karts (tarjeta 3,9 contra 4,9): ~3/4 es la base; el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] ~~**E4** · Teléfonos de referencia reales~~ — descartado 2026-10-31 10:09 · el dueño (2026-10-27): solo este PC y el Oppo, nada de conseguir otros aparatos; la gama media y baja se simulan con el aparato de mentira (H1). Bitácora §177.4
- [x] **E5** · PCs débiles y portátiles con dos tarjetas — hecho 2026-10-29 16:17 · bitácora §156: una sola tarjeta al cargar, las otras dos preguntas a los 20 s y solo si sirven (?unaTarjeta=0); medido con 8 y 4 lógicos
- [x] ~~Listo cuando: línea base guardada: este PC medido y los demás escalones simulados (el Oppo, del 2026-10-30, queda como referencia)~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 0 (N2 y W5: la escalera otra vez, con la revisión de límites)
- [x] Listo cuando: el impuesto del navegador medido (nativo contra wasm, en el mismo PC) — hecho 2026-10-28 01:02 · bitácora §153: ×2,2 en este PC (medir-impuesto.mjs)
- [x] ~~Listo cuando: `paridad` y `fma` dan lo mismo en Chrome del PC (también forzado a cada compilador) que en Node~~ — descartado 2026-10-31 22:30 · versión 4: la paridad va en cada cambio de la etapa 2; la FMA de M5 se descartó

#### Paso 4. Que nada se trabe al cargar (10/10)

- [x] **C1** · Tope al precalentado de pipelines, siempre — hecho 2026-10-27 20:42 · bitácora §117
- [x] **C4** · Descargas con freno, con prioridad y en su momento — hecho 2026-10-27 23:22 · bitácora §132, §139 y §142: prioridad high/low y la cubeta de fichas, prendida sola en la sala ya cargada (?freno=0|1); sin medir el latido con red lenta
- [x] **C6** · Armar los archivos del juego (MEMFS) sin una tarea larga — hecho 2026-10-27 21:53 · bitácora §130: armar MEMFS 59 → 35 ms en el PC (?armadoRapido=0); en el teléfono, sin medir
- [x] **C7** · La precarga de la sala sin el bloque de 122 MB que nadie usa — hecho 2026-10-27 20:56 · bitácora §119
- [x] ~~**C8** · Compilar el programa antes de la carrera y conservar su caché de código~~ — descartado 2026-10-29 16:39 · bitácora §157: medido solo en este PC (16 y 4 lógicos): listo 0,08 s tras bajar y 1.ª carrera a 60 en las dos visitas; V8 solo guarda lo optimizado, que sale jugando. El calentamiento del teléfono (~21 s a 20–37 fps) sigue abierto: anotado en H11
- [x] **C10** · Pestaña oculta: no gastar CPU de más — hecho 2026-10-27 22:17 · bitácora §120 y §134: oculta, la espera duerme (sala) o el juego se pausa (solo): CPU 80 → 0 % (?pausaOculta=0, ?esperaOculta=0)
- [x] **D2** · Pausar todas las descargas de fondo durante la carrera — hecho 2026-10-27 21:16 · bitácora §121
- [x] **D6** · Pedir almacenamiento persistente — hecho 2026-10-27 20:47 · bitácora §118
- [x] **D13** · Guardar la partida y la lista de pipelines fuera de la carrera — hecho 2026-10-27 21:21 · bitácora §122
- [x] **U1** · El precalentado no sigue dentro de la carrera — hecho 2026-10-27 23:22 · bitácora §133 y §140: la espera de la mitad en el teléfono y el precalentado en pausa en la carrera (aurora, recompilado; ?pausaPrecalentado=0); la cola se vacía a los 14–16 s, la pausa es un seguro
- [ ] Listo cuando: abrir el juego no atrasa más de 50 ms el latido de otra pestaña — en curso 2026-10-29 17:10 · bitácora §158: en 2C/4T, con el tope de verdad, de 38–48 trabas > 50 ms a 1 (p99 14 ms); queda ~300 ms al largar la 1.ª carrera: V8 optimizando (TurboFan) el código de la carrera, con --liftoff-only desaparece (63 ms), pero el juego cuesta 15,0 ms por cuadro en vez de ~8,7 y la carrera baja a 59,2 fps: es diagnóstico, nunca el arreglo; no se arregla desde la página (no se puede pedir a V8 que optimice antes ni más despacio): va con H11 (y N3); medido solo en este PC atado a 4 lógicos
- [x] Listo cuando: cero descargas de fondo y cero tareas largas durante la carrera — hecho 2026-10-31 09:10 · bitácora §177: en este PC 0 tareas largas y 0 pedidos al Worker en 40 s de carrera (60 fps); con la CPU ×4 también 0 pedidos, pero cada cuadro del juego (68 ms) es una tarea larga: el motor, pasos 6 y 8 (N3)

#### Paso 5. Nada se baja durante la carrera (11/11)

- [x] **D1** · Paquete de carrera: todo lo de la carrera, bajado y fijo en memoria antes de la cuenta — hecho 2026-10-31 08:50 · bitácora §176.3: el paquete trae la música de la pista, lo común (StaticR, la fanfarria de la largada), las dos voces de cada personaje y lo aprendido por pista; la sala pide la carrera en curso y la siguiente; con la carrera andando 0 pedidos a la red en este PC y en la gama baja (13.2, 1.ª y 2.ª vuelta), el juego no esperó nunca; medido con mkwRedEnCarrera (mkwFaltas contaba también la caché)
- [x] **D3** · Dar prioridad a lo que el juego está esperando — hecho 2026-10-28 01:02 · bitácora §146: apurar lo de fondo (?apurar=0); banco 50 contra 1.672 ms; la pareja limpia en la página, pendiente
- [x] **D4** · Los karts de las CPU, en un solo lote — hecho 2026-10-30 20:31 · bitácora §169: el paquete de carrera (paquete-carrera.mjs, ?paqueteCarrera=0) pide los 12 karts y sus voces en un lote; acierta 9 de 10 piezas; en un jugador la largada no cambia (12,3 → 11,9–12,2 s; gama baja 104,8 → 104,6 s) y en la gama baja quita la única espera de la carrera (t173-*)
- [x] **D5** · Una versión por archivo: subir algo no borra la caché de todos — hecho 2026-10-31 02:25 · bitácora §174.1: huella por archivo en el manifiesto y en cada clave de la caché, barrido de lo huérfano (?versionArchivo=0); un archivo cambiado: la 2.ª visita 62,8 → 50,2 MB, 0 → 40 bloques de la caché
- [x] **D8** · Los videos de los menús (THP) sin cortes — hecho 2026-10-31 05:45 · bitácora §174.2/§174.4: el THP sin copia (?thpDirecto=0) y la cabeza de 2 MB de los 7 videos de los menús (?videosCabeza=MB); por los menús a la 13.2: largada 53,7 → 52,5 s en este PC, en la gama baja dentro del ruido (157 → 154 s); en la carrera nadie esperó a la red
- [x] **D9** · Regrabar `bloques.json` con el camino real — hecho 2026-10-30 18:40 · bitácora §168: la semilla con 3 carreras enteras del camino de hoy (294 bloques): esperas a la red antes de largar 17–19 → 6–9, lecturas con la carrera armada 14–15 → 4–6 (t168-*); 0 esperas de la cuenta a la meta; bloques-d9.json, la sube el dueño
- [x] **D12** · El fantasma de la página, bajado antes de la cuenta — hecho 2026-10-28 01:02 · bitácora §147: de a 3 con tope 4 s, 804 → 406 ms (?fantasmaParalelo=0)
- [x] **U2** · GP y VS: pedir la pista apenas se elige — hecho 2026-10-31 01:00 · bitácora §169: la pista se pide apenas se elige en los menús (`enMenus`, quieta 1 s; GP: la copa en baja); VS 13.2 3,7 s antes en este PC y 15,7 s en la gama baja, sin arranques falsos; `?pistaTemprana=0`
- [x] **C2** · Precalentar solo lo que viene, por pantalla y por pista — hecho 2026-10-31 05:45 · bitácora §174.3/§174.4: cada pipeline con su etiqueta (menús, común, una pista; MKWPIPE2), los de una pista al elegirla, poda a las 8 visitas (?pipelinesPista=0); armados de golpe antes de largar 15 → 3 en la gama baja y 6 → 3 en este PC; la carga con CPU ×4: tareas largas 21,7 → 19,9 s; también en la v0.9.3
- [x] **C3** · Ningún pipeline armado de golpe en plena carrera — hecho 2026-10-30 19:28 · bitácora §172: aurora anota los armados de golpe y los pone primero en la lista; semilla de 795 (163 urgentes): de golpe antes de largar 28/101/125 → 10/10/42 y en la gama baja 93 → 19, en la carrera 0 (t172-*); pipelines-c3.bin, la sube el dueño (?pipelines=)
- [x] **C5** · Escribir la caché en bloques grandes y sin copias de más — hecho 2026-10-30 20:31 · bitácora §171: grupos de 8 bloques (2 MB) en una entrada con índice, sin copias (?cajaGrande=0); CPU ×4, 2.ª visita: tiempo en tareas largas 22,8 → 17,2 s (−25 %), 1.ª −4 %, en este PC igual (t173-caja*)
- [x] Listo cuando: cero lecturas a la red de la cuenta a la meta, con perfil nuevo, en la sala y en un jugador — hecho 2026-10-31 08:56 · bitácora §176.3: de la cuenta a la meta 0 pedidos a la red (mkwRedEnCarrera, etapas 1-2): un jugador con perfil nuevo en este PC y en la gama baja (13.2) y la sala (prueba-sala 46/46, dos pestañas, la copa de 2)
- [x] Listo cuando: subir un archivo a R2 no vacía la caché de los demás — hecho 2026-10-31 08:56 · bitácora §174.1 (D5): una versión por archivo; un archivo cambiado en R2 solo vuelve a bajar ese (medir-version-archivo.mjs: la 2.ª visita 62,8 → 50,2 MB)

#### Paso 6. El motor: el código traducido y la memoria de la Wii (4/4)

- [x] ~~**M8** · Pasadas propias del traductor~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §4b y §5, docs/soluciones-motor.md §6): las pasadas que agrandan el código no se hacen más. Lo medido (bitácora §178, §193 y §193.1): no releer r14–r31 ×1,00, hojas en línea al doble −6 % en la gama baja, memo de indirectas ×0,993: no se adoptan; banderas: el techo da ×0,88 en Node pero cambia la carrera (inválido); el seguro (detenido por el dueño a medias) resuelve todo el programa pero U = 0xFF: falta saber qué funciones pueden ser destino de una llamada indirecta (§193.1). Lo útil, terminar el seguro, sigue en W14 (el CR perezoso)
- [x] **M1** · Accesos a memoria rápidos: rangos y psq con puntero directo — hecho 2026-10-31 13:45 · bitácora §182: los rangos y los psq con la tabla de páginas (MKW_MOTOR_RANGOS); junto con M2 y la vuelta de 8 bytes con SIMD: Node ×0,930, gama baja +5,2 %, este PC +1,6 % (ruido); paridad 28/0, la sala 74 huellas iguales; en la base del paso 6 (v0.9.3)
- [x] **M2** · Escrituras en línea — hecho 2026-10-31 13:45 · bitácora §182: el camino rápido de Read/Write en línea (MKW_MOTOR_EN_LINEA); medido junto con M1
- [x] **N15** · Subir WiiCompiled a la versión 0.9.3 antes de tocar el traductor — hecho 2026-10-31 23:10 · bitácora §170: N15a hecho (v0.9.3 con nuestra aurora: paridad 22/0, la misma carrera 75/75 en la sala, la misma velocidad ±3 %; es la base del motor, M1/M2 §182). Lo que faltaba, la aurora nueva (N15b), se descartó en la poda. §242 (2026-11-08): revisado; todo programa desde §182 sale de esta línea (el final de E6 de terceros/Wiicompiled-motor-h6); la falla vieja de prueba-sala --rapida en M22 (§203) es de esta línea y sigue abierta
- [x] ~~Listo cuando: `paridad` 22/0, la huella ampliada y los fantasmas iguales~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 2 (criterio 1)
- [x] ~~Listo cuando: la carrera de N13 (tramo 600–2400) con el wasm más cerca del nativo, medido: hoy ×3,1~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 2 (criterio 2: el código traducido ×1,3 en la gama baja simulada)

#### Paso 7. Lo caliente reescrito con IA, y no volver a subir lo que no cambia (3/3)

- [x] **N14** · La IA reescribe las funciones calientes, con un comprobador automático que exige el mismo resultado — hecho 2026-10-31 16:40 · bitácora §181.2: comprobador bit a bit (0 diferencias en 8 M llamadas), pero las reescrituras no ganan (×1,01 / ×0,99, ruido) porque el impuesto está repartido (1.886 funciones, las 50 primeras = 34 %); no se adopta ninguna; la FMA «punto medio» que salió de acá (3× suelta en el banco, 0 diferencias en 70 M casos) tampoco se adopta: medida en el juego por el paso 6 (§184) es exacta pero más lenta (Node ×1,018, gama baja −7,5 %: copiada en línea en miles de lugares el código crece)
- [x] **G3** · No volver a subir lo que no cambió — hecho 2026-10-31 14:30 · bitácora §181.1: los anillos de subida de aurora (vértices e índices por huella xxh3 al cerrar el lote, vtx_start corregido); la subida por imagen 1,2–1,4 MB → 0,4–0,5 MB (solo uniformes), la tarjeta de la gama baja −10 %, CPU igual (?anillo=0)
- [x] **H12** · La pista quieta en la tarjeta: no convertir ni subir otra vez lo que no cambia — hecho 2026-10-31 14:30 · bitácora §181.1: los arreglos de la pista (storage) por lugar + generación de escrituras del juego, en el anillo de storage: 952 MB reusados contra 0,83 MB escritos en una carrera (?anillo=0)
- [ ] Listo cuando: el comprobador con 0 diferencias en cada función aceptada, y la CPU por cuadro del tramo fijo más baja en la gama baja simulada y en este PC — en curso 2026-10-31 16:45 · SIN CUMPLIR (bitácora §181.2 y §184): la CPU por cuadro no bajó. Las reescrituras de N14 dan 0 diferencias pero ×1,010 / ×0,991 (ruido) y la FMA «punto medio» ×1,018 en Node y −7,5 % en la gama baja: ninguna se adopta. El porqué: el impuesto está repartido parejo (1.886 funciones, las 50 primeras = 34 % del cuadro), no hay una función caliente que reescribir; bajar la CPU queda para el motor (pasos 6, 13 y 14)
- [x] Listo cuando: los KB subidos por imagen en la carrera bajan a una fracción de hoy (medido en este PC con el informe de rendimiento) — hecho 2026-10-31 16:40 · bitácora §181.1: en este PC la subida por imagen 1,2–1,4 MB → 0,4–0,5 MB (solo uniformes), verificado con 0 diferencias; en el teléfono, con el informe la próxima vez que el dueño mida el Oppo

#### Paso 10. La tarjeta del teléfono, primera tanda (6/6)

- [x] ~~**N9** · La tarjeta del teléfono: de qué están hechos los 34 ms~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §2 y §5; docs/kartpad.md §2): la tarjeta no frena en ningún escalón simulado (0,2–3,3 ms por imagen, bitácora §164; el Oppo ~3 ms, §173) y en KartPad bajar la resolución no cambia nada; el dibujo nativo (W15) vuelve a medir la tarjeta
- [x] **G5** · El aspecto real de la vista en el teléfono — hecho 2026-10-31 21:40 · bitácora §177.1: en este PC, con force_16_9, la vista es 16:9 en cualquier forma de ventana (2,18:1 y parada con barras; medir-aspecto.mjs); el 2,18:1 del Oppo era el lienzo. El informe dice ahora la vista; el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] **G2** · Pasadas pensadas para las GPU de los teléfonos — hecho 2026-10-31 21:40 · bitácora §177.2: aurora descarta la profundidad que nadie vuelve a leer (?descartarZ=0); en Mario Kart no ocurre: las 4.171 copias que limpian cubren 893×456 de 939×528, ninguna entera; en este PC sin cambio (0,2 ms de tarjeta). Limpiar el recuadro como imagen entera pasa a N9, con el perfil por pasada en este PC y con ?lastreGpu; el Oppo ya no se mide (el dueño, 2026-10-31)
- [x] ~~**G7** · Vértices como atributos en vez de storage buffers~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5; docs/soluciones-decompilacion.md §2.2): la tarjeta no frena (bitácora §164); los vértices en búferes propios los arma el renderizador nativo, W15
- [x] ~~**G10** · Bajar la resolución no es la palanca~~ — descartado 2026-10-31 22:30 · versión 4: confirmado y cerrado como ítem (la tarjeta no frena, bitácora §164; en KartPad bajar la resolución no cambió nada, docs/kartpad.md §2); la regla «no sacar calidad» queda en las reglas del plan
- [x] ~~**H13** · La tarjeta del teléfono a 2 ms: un camino de dibujo pensado para baldosas~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5; docs/soluciones-decompilacion.md §2.2): la tarjeta no frena en ningún escalón (bitácora §164); el camino de dibujo propio (render bundles, búferes de vértices) es el renderizador nativo, W15 y W16
- [x] ~~Listo cuando: la tarjeta a 4 ms o menos por imagen con el aparato de gama media en el tramo fijo (`&perfilGpu=1`, §164; la meta final, en el paso 15, es 12 ms o menos con `?lastreGpu=6`)~~ — descartado 2026-10-31 22:30 · versión 4: la tarjeta no frena (bitácora §164); el dibujo se mide en la etapa 4 (W15, W16)
- [x] ~~Listo cuando: el aparato de gama media (`&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6`) a 60 en un jugador~~ — descartado 2026-10-31 22:30 · versión 4: las metas por escalón son otras (60 dibujados al borde en la gama media); se miden en la etapa 6

#### Paso 11. La sala asíncrona (6/6)

- [x] **R3** · El ping lleva el cuadro: pausar al que «se oye» pero no avanza — hecho 2026-10-31 10:35 · bitácora §177.5: la traba viva se pausa a los 150 ms (?trabaViva=0); Ana esperó 985 → 181 ms (banco relevo caso 20)
- [x] **R2** · Simular a 60 aunque se dibuje menos (separar la simulación del dibujo) — hecho 2026-10-31 18:55 · bitácora §192: saltarse el dibujo de un cuadro sin cambiar la carrera (apagado; ?saltarDibujo=N): en el cuadro saltado DrawMain corre solo SwitchScnRoot (lo que la lógica lee) y la escena 3D no va a la tarjeta; la sala con B saltando 1 de 2 y 2 de 3 da las mismas huellas, el fantasma igual byte por byte; lo ganado se mide con N8 (paso 7), que deja de presentar esos cuadros
- [x] **G1** · Sala: «todo a la vista» solo para la lógica, el recorte normal para el dibujo — hecho 2026-10-31 13:55 · bitácora §179.1: el dibujo recorta con las marcas de verdad (ScnMgr::DrawMain), la lógica sigue con «todo a la vista» (?recorteDibujo=0); la misma carrera en 11 salas; −0,7 ms por cuadro en este PC, igual al techo ?arreglos=0 (hoy el arreglo cuesta ~0,7–1 ms, no 4–5); el teléfono: medir-oppo parte D
- [x] **R1** · El árbitro como modo normal (todos esperan a uno solo) — hecho 2026-10-31 16:55 · bitácora §191: el árbitro como opción (?arbitro=1, apagado): la autoridad escribe los botones de todos y cada uno espera solo a ella; A esperó 0 ms en 8 trabas de 1,5 s (antes mediana 310), la PC lenta ya no frena, con 6 jugadores 120 paquetes/s en vez de 300; precio: 3–5 cuadros más de retraso; si va por omisión, lo decide la sesión con el Oppo (banco relevo caso 22)
- [x] **R7** · La autoridad, siempre la PC con más margen y más subida — hecho 2026-10-31 11:40 · bitácora §179: el puntaje de la autoridad suma margen por cuadro, subida y «teléfono» (?autoridadCapaz=0); un teléfono pasa el papel a un PC al saber que hay uno (banco relevo caso 21; prueba-sincro --extra-a=&comoTelefono=1 14/14)
- [x] **R9** · Pestaña oculta en la sala — hecho 2026-10-31 10:35 · bitácora §177.6: la pestaña oculta manda el mando en reposo al segundo (?ocultaCero=0); banco controles 53/53, prueba-sincro --oculta-b=12 15/15
- [x] ~~Listo cuando: una traba de 1,5 s de uno les cuesta menos de 20 ms a los demás~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 5 (criterio 2), con el árbitro; R1 ya midió 0 ms en 8 trabas con ?arbitro=1 (bitácora §191)
- [x] ~~Listo cuando: en este PC, un Chrome normal y otro como teléfono (emulación, CPU frenada y el lastre de gama media): 3 carreras con la huella ampliada igual~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 5 (criterio 3)

#### Paso 12. La página liviana (10/10)

- [x] **P3** · Sin filtros CSS encima del lienzo del juego — hecho 2026-10-28 01:02 · bitácora §148: sombras en lienzos quietos, sin desenfoque sobre el juego (?filtrosLivianos=0)
- [x] **P4** · Un solo planificador por cuadro (reloj del monitor, esperas y rAF) — hecho 2026-10-27 23:22 · bitácora §136 y §143: un solo bucle de cada refresco (relojMonitor.alRefresco, anillo de 240; ?planificador=0); parejas 91,5 % con / 90,6 % sin, igual
- [x] **P6** · El estado de los menús, una vez por cuadro — hecho 2026-10-27 21:55 · bitácora §131: el filtro de la sala una vez por paso (?menusUnaVez=0)
- [x] **P7** · Registro circular, pintado solo si se ve — hecho 2026-10-27 21:26 · bitácora §125 (el medidor sigue en la consola)
- [x] **P8** · Relojes chicos que se suman — hecho 2026-10-27 21:52 · bitácora §126 y §129: cortina y récords apagados cuando no hace falta (?relojesLivianos=0)
- [x] **R8** · Nada grande por el canal fiable durante la carrera — hecho 2026-10-27 22:24 · bitácora §135: tcp en trozos de 1 KB; el udp detrás de 200 KB llega en 1 ms en vez de 9 (?trozos=0)
- [x] **R10** · La revisión de conexiones, liviana en carrera — hecho 2026-10-27 21:31 · bitácora §127
- [x] **E3** · Lo táctil y la inclinación, sin costo por cuadro — hecho 2026-10-27 21:34 · bitácora §128
- [x] **E6** · Monitores que no son de 60 Hz — hecho 2026-10-27 23:22 · bitácora §137 y §144: aviso en el medidor y en Gráficos; la prueba en el monitor de 144 Hz midió 240 (Chrome siguió el principal): la mira el dueño
- [x] **C9** · Medir y bajar la memoria de la pestaña y del proceso de GPU — hecho 2026-10-27 23:22 · bitácora §138 y §141: medir-memoria.mjs; heap 512 → 320 MB y los chicos sueltos: la pestaña 1.186 → 938 MB, 2 juegos 3.936 → 3.458 MB (recompilado)
- [x] ~~Listo cuando: casi ninguna limpieza de memoria en un minuto de carrera~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 6 (criterio 1)
- [x] ~~Listo cuando: `correr-todo` en verde~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 6 (criterio 4)

#### Paso 13. El motor: las cuentas (6/6)

- [x] ~~**M3** · Llamadas indirectas más baratas~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5; docs/soluciones-motor.md §6): el despacho de llamadas indirectas pesa ≤ 3,5 % del impuesto (bitácora §166.3); no paga
- [x] ~~**M5** · La FMA de dos carriles de una vez~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5; docs/soluciones-motor.md §6): las variantes de la multiplicación-suma no ganan; la FMA «punto medio» perdió −7,5 % en la gama baja (bitácora §184) y la de dos carriles es otra variante del mismo costo, que pesa poco
- [x] ~~**H8** · La multiplicación-suma del aparato, comprobada al arrancar~~ — descartado 2026-10-31 22:30 · versión 4 (docs/soluciones-motor.md §3 y §6; docs/techo-pasos.md §5): otra variante de la multiplicación-suma; relaxed_madd no da los mismos bits en todas las máquinas y el producto de dos singles ya es exacto en double, así que la FMA ahorra poco (bitácora §184)
- [x] ~~**H9** · Las cuentas de a dos de la Wii y las matrices en SIMD de verdad~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5): las cuentas de a dos y las matrices en SIMD eran las funciones de N14: ×1,01, la de SIMD más lenta (bitácora §181.2)
- [x] ~~**M4** · Versiones nativas exactas de PSMTX, VEC, memcpy y memset~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5): reescribir funciones de a una no gana, el impuesto está repartido parejo (las funciones de matrices de N14 dieron ×1,01, la de SIMD más lenta; bitácora §181.2). Lo que puede ganar es una isla entera con sus datos nativos (W2, W17)
- [x] ~~**M10** · Cambios de fibra y suspensiones JSPI: contarlos y recortarlos~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5): las idas y vueltas de JSPI pesan < 1 % (4,8 µs cada una, ~10 por cuadro; bitácora §166.2)
- [x] ~~Listo cuando: el banco `fma` con 40 millones de casos, en Node y en Chrome del PC (también forzado a cada compilador)~~ — descartado 2026-10-31 22:30 · versión 4: el paso se descartó entero (M5, H8: la FMA)
- [x] ~~Listo cuando: la huella y los fantasmas iguales~~ — descartado 2026-10-31 22:30 · versión 4: el paso se descartó entero; la huella y los fantasmas, en cada etapa

#### Paso 14. El motor: lo visual en paralelo (4/4)

- [x] ~~**N5** · Traductor y memoria: lo que queda por sacar~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §4b; docs/soluciones-motor.md §6): sus partes van repartidas: la RAM fija en H6/H7, las banderas en W14, la pila en W12; más hojas en línea perdió −6 % en la gama baja (bitácora §193)
- [x] ~~**N6** · Reescribir en nativo lo que solo se ve: efectos, animación de los modelos y 2D~~ — descartado 2026-10-31 22:30 · versión 4 (docs/soluciones-decompilacion.md §2 y §5): lo reemplazan las islas del dibujo, W16 (D-b) y W18 (los efectos), con sus datos en formato nativo y en el Worker del dibujo
- [x] ~~**H10** · Lo que solo se ve, en paralelo y fuera del hilo del juego~~ — descartado 2026-10-31 22:30 · versión 4 (docs/soluciones-arquitectura.md §1 y §7): lo reemplaza W11 (A2): lo que solo se ve va al Worker del dibujo de W10, no a hilos ayudantes dentro del mismo programa
- [x] ~~**N7** · Reescribir exacto lo caliente de la lógica~~ — descartado 2026-10-31 22:30 · versión 4 (docs/techo-pasos.md §5; docs/soluciones-decompilacion.md §5.1): reescribir exacto de a una función no gana (N14 lo contestó, bitácora §181.2); lo reemplaza la isla de la lógica: W2 (el piloto) y W17
- [x] ~~Listo cuando: el hilo del juego a 3,3 ms o menos, medido como CPU pura en el tramo fijo~~ — descartado 2026-10-31 22:30 · versión 4: la meta de 3,3 ms la reemplazan las metas por escalón (etapas 1, 2 y 4)
- [x] ~~Listo cuando: y a 12 ms o menos con `?lastre=3.5`~~ — descartado 2026-10-31 22:30 · versión 4: lo reemplaza el criterio 3 de la etapa 4 (la gama media simulada a 16,7 ms en el hilo de la carrera)

#### Paso 15. Gráficos, segunda tanda: texturas, interpolación y calor (2/2)

- [x] **G6** · Texturas comprimidas en la GPU — hecho 2026-10-31 21:40 · bitácora §190.2: CMPR → BC1 sin volver a comprimir (aurora texture_convert.cpp cmpr_to_bc1, ?texturasBc=1, apagado por omisión); calidad: 51 dB contra la RGBA8 en 3,9 M texeles del juego, 0,18 % a más de 8 tonos, la foto difiere menos que dos fotos de siempre entre sí; 66 de 89 CMPR, 15,2 → 1,9 MB en la tarjeta; tramo fijo 2+2: este PC CPU −1,3 % (ruido), gama baja tarjeta 2,13 → 2,03 ms (−4,5 %, dentro del ruido). No se prende por omisión: la ganancia no se distingue del ruido y los teléfonos no tienen BC (ETC2/ASTC, sin hacer); queda como opción
- [x] ~~**G4** · Ubershader: dibujar mientras compila~~ — descartado 2026-10-31 21:40 · bitácora §190.3: medido, no conviene ahora: los dibujos que se saltan por un pipeline que se compila son ~0,1 % y solo en la 1.ª visita; el ubershader serían semanas en las dos auroras. La parte barata (lo que el juego pide en la carrera, contado por aurora: de la cola / de la lista esperando / nuevo): con la semilla por pista (pipelines-c2) quedan 3 pedidos en la carrera en este PC y 1 en la gama baja (antes de C2, 18–57); las 64 del Oppo (§173) eran todas de fondo con la semilla vieja: las saca publicar pipelines-c2 (a confirmar en el teléfono, docs/medir-oppo.md F)
- [x] ~~Listo cuando: la tarjeta a 2 ms o menos por imagen en el tramo fijo, y a 12 ms o menos con `?lastreGpu=6`~~ — descartado 2026-10-31 22:30 · versión 4: la tarjeta no frena (bitácora §164); la tarjeta se mide con el dibujo nativo (etapa 4)
- [x] ~~Listo cuando: el que dibuja a 30 ve 60 con la interpolación~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 3 (N8)

#### Paso 16. La puerta B y la prueba final (1/1)

- [x] ~~**N10** · Plan C1: una app de Android con el juego nativo (descartado: el producto es siempre la página)~~ — descartado 2026-10-29 15:30 · el dueño, 2026-10-29: el producto final corre siempre en la página, nunca como app descargable
- [x] ~~Listo cuando: cada escalón con su meta cumplida o su plan C decidido~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 6 (criterio 2, contra las metas de la versión 4)
- [x] ~~Listo cuando: la sala de 12 a 60 fps, sin esperas de más de 50 ms~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 6 (criterio 3)
- [x] ~~Listo cuando: una hora de sala con la memoria plana~~ — descartado 2026-10-31 22:30 · versión 4: pasa a la etapa 6 (criterio 3)

#### Paso 17. La poda del 2026-10-31: lo que no rinde o no hace falta (18/18)

- [x] ~~**H3** · La CPU y la tarjeta en paralelo, no en serie~~ — descartado 2026-10-31 23:10 · poda, no rinde: la tarjeta no frena en ningún escalón simulado (0,2–3,3 ms por imagen, bitácora §164), así que la CPU y la tarjeta en paralelo dan ~0 (docs/techo-pasos.md §2, paso 9); con W10 el dibujo ya va un cuadro atrás
- [x] ~~**H4** · La carrera en un núcleo, todo lo demás en otros: el mapa de hilos~~ — descartado 2026-10-31 23:10 · poda, duplicado: el mapa de hilos lo reemplazan A1-s (W10) y A2 (W11), que se llevan también el código del juego que dibuja (docs/soluciones-arquitectura.md §1); la regla «la carrera no se reparte entre núcleos» queda en las reglas del plan
- [x] ~~**N4** · Varios núcleos: aurora, el sonido y el disco fuera del hilo del juego~~ — descartado 2026-10-31 23:10 · poda, duplicado: aurora y el dibujo van al Worker B (W10) y el hilo de sonido con A2 (W11); la versión con memoria compartida (A1-h) gana solo −0,1 a −0,5 ms más, con riesgo alto en Android (docs/soluciones-arquitectura.md §1 y §7)
- [x] ~~**G9** · aurora en su propio hilo (como el «dual core» de Dolphin)~~ — descartado 2026-10-31 23:10 · poda, duplicado de W10: aurora va al Worker B sin memoria compartida; como hilo con memoria compartida (A1-h) rinde −0,1 a −0,5 ms más, con riesgo alto en Android (docs/soluciones-arquitectura.md §1 y §7)
- [x] ~~**P9** · La página del juego en su propio proceso (Document-Isolation-Policy)~~ — descartado 2026-10-31 23:10 · poda, no es necesario: W10 va sin memoria compartida y anda en cualquier Chrome; con memoria compartida (A1-h) solo −0,1 a −0,5 ms más (docs/soluciones-arquitectura.md §1 y §7). Queda usable: web/navegador/aislar.mjs (?aislar=dip), el service worker y el banco aislamiento 11/11 (bitácora §187)
- [x] ~~**N15b** · La aurora nueva del original en el navegador~~ — descartado 2026-10-31 23:10 · poda, no rinde: la aurora nueva no trae velocidad (su versión en hilos dio ×1,05–1,10 en nativo, docs/kartpad.md §8) y portarla son 2–4 semanas; el dibujo en otro núcleo va con nuestra aurora (W10) y los arreglos cortos de dibujo ya entraron con N15a (bitácora §170, parches/aurora-n15a.diff)
- [x] ~~**M9** · La mezcla de sonido AX más barata~~ — descartado 2026-10-31 23:10 · poda, duplicado: el hilo de sonido del juego (~0,57 ms) sale del hilo de la carrera con A2 (W11; docs/soluciones-arquitectura.md §7; docs/soluciones-decompilacion.md §5.3: «mejor sacarlo del hilo»)
- [x] ~~**D11** · El disco en un Worker y contar bytes sin clonar respuestas~~ — descartado 2026-10-31 23:10 · poda, no rinde: con la carrera andando no se pide nada a la red (D1, bitácora §176.3), y con el juego en un Worker (N3, P10) el disco ya no comparte el hilo de la carrera
- [x] ~~**D10** · Leer sin suspender cuando el dato ya está en memoria~~ — descartado 2026-10-31 23:10 · poda, no rinde: las idas y vueltas de JSPI pesan < 1 % (4,8 µs cada una, bitácora §166.2; M10 se descartó por lo mismo)
- [x] ~~**M11** · Lo que no hay que hacer en el motor~~ — descartado 2026-10-31 23:10 · poda, no es trabajo: es la lista de lo que no se hace en el motor; queda en las reglas del plan y en docs/soluciones-motor.md §6
- [x] ~~**W18** · Los efectos (partículas) en nativo~~ — descartado 2026-11-04 08:30 · bitácora §222: el techo del dibujo de los efectos (EGG::EffectManager::Draw saltado) +3,0/−0,5 % en la gama baja con límites, +5,7/+1,7 % en este PC: no pasa el 5 %; el cálculo ya es sumidero (W11). Antes (2026-10-31) podado como duplicado de W16
- [x] ~~**P1** · Un solo lector de mandos por cuadro, sin basura~~ — descartado 2026-10-31 23:10 · poda, no rinde: con el juego en un Worker (N3, P10) los mandos se leen en la página, fuera del hilo de la carrera; en el teléfono eran 60–150 µs por refresco, < 1 % (docs/techo-pasos.md §2, paso 12: «se pisa con el 8»)
- [x] ~~**P2** · «Modo juego» del sitio mientras se juega~~ — descartado 2026-10-31 23:10 · poda, no rinde: con el juego en un Worker (N3, P10) los relojes y el repintado del sitio ya no caen dentro del cuadro de la carrera (docs/techo-pasos.md §2, paso 12: «se pisa con el 8»)
- [x] ~~**U4** · Reloj del juego enganchado al monitor (sin cuadros repetidos)~~ — descartado 2026-10-31 23:10 · poda, no es necesario para el objetivo: es un cuadro repetido cada ~17 s (59,94 contra 60 Hz) y no cambia los fps; el enganche de hoy queda como está (bitácora §114.8)
- [x] **E1** · Detectar el ahorro de energía de Chrome (todo a 30 Hz) — hecho 2026-11-08 14:20 · bitácora §243 (antes §190.1; la poda del 31-10 lo había descartado por no poder probarse): el Ahorro de energía DE VERDAD de Chrome se prende en este PC con su preferencia (Local State, performance_tuning.battery_saver_mode.state = 3): refrescos 4,2 → 33,3 ms; con el juego el vigía ve 34,7 ms y avisa 🔋 (prueba-energia 12/12, banco energia 20/20); sin el ahorro no avisa. Prendido por omisión (?ahorro=0 lo apaga; con Playwright solo con ?ahorro=1). Falta en el teléfono (lo hace el dueño al final): el ahorro con poca batería en Android
- [x] **E2** · Calor en el teléfono — hecho 2026-11-08 14:20 · bitácora §243 (antes §190.1; descartado en la poda): en el PC el vigía no da falsa alarma (4 «minutos» de 15 s parejos, 6,5–6,9 ms; y la copa de 62 min de V6 estable ±3 %) y con un «calor» de mentira (el lastre del hilo del juego sube a 2,5 con la carrera andando: 6,5 → 18 ms por cuadro) avisa 🌡️ (prueba-energia 12/12; ?calorSeg=N y estado.k del lastre, solo pruebas). Sigue apagado por omisión (?calor=1). Falta en el teléfono (lo hace el dueño al final): una copa entera en el Oppo para ver si de verdad sube y si el aviso sale a tiempo
- [x] ~~**D7** · Dominio propio para el Worker (la caché del borde de Cloudflare)~~ — descartado 2026-10-31 23:10 · poda, no es necesario para el objetivo: acorta la carga (~150 ms por pedido), no el cuadro, y con la carrera andando no se pide nada (bitácora §176.3); queda como opción del dueño en docs/publicar.md
- [x] ~~**D14** · El tope diario del Worker gratis (100.000 pedidos)~~ — descartado 2026-10-31 23:10 · poda, no es necesario para el objetivo: es de operación, no de rendimiento; 123 llamadas por 1.ª visita alcanzan para ~800 visitas por día (bitácora §104); vigilar el tope queda en docs/publicar.md
- [x] Listo cuando: cada ítem descartado con su porqué y el documento que lo decide — hecho 2026-10-31 23:10 · PLAN.md, registro del 2026-10-31 23:10

