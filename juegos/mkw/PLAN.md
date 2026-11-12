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
- ~~**El VR solo se mueve en línea**~~ — **cambió el 2026-10-19**: el VR se mueve con cada carrera de la sala (§82).
- **Se quita el visor de salas de Retro WFC** (`salas.mjs`): el multijugador va solo por nuestra página.
- **Dos PCs = dos juegos abiertos en el mismo PC** (así se probó BT3): basta con las pruebas de dos pestañas y una
  prueba a mano con dos ventanas.

### Etapa A — Cerrar lo de hoy y poner el trabajo a salvo
- ✅ A1. Terminar las pruebas: `prueba-copa.mjs` (copa offline de 4 carreras), modo Node recompilado +
  `prueba-arranque.mjs` (13 puntos), y ver por qué el navegador da 20 puntos si `CLAUDE.md` dice 21
- ✅ A2. Sitio: `npm run build` en `colabtex` (cambiaron `mkw.js` y `motor.js`) + `npm run test:juegos` + `mkw.test.cjs`
- ✅ A3. Papeles al día: este plan (marcar lo hecho), `docs/en-linea.md` (fases con su estado real), `CLAUDE.md`
- ✅ A4. `subir-kit.sh` y commit en `claude/loving-planck-9k2yam` **solo con lo nuestro** (kit, sala de Mario Kart en
  `colabtex/src/juegos/`, pruebas, reglas de Firebase, `juegos-app.js` + `juegos.html`); afuera el trabajo ajeno, los
  cambios de solo fin de línea y los sellos de `i18n.js` (se repite con cada tanda: el último, `27b8e92` con §78–§79.5)
- ✅ A5. Primer commit del repo local `MKW RETRO` (revisando `git status` contra `.gitignore`); desde ahí, un commit por avance
- ✅ A6. ~~Push de la rama y PR a `main`~~ → **sin PR ni push** (el dueño lo retiró). `main` se juntó en la rama local (conflictos de casino/Momazo/PRO DEFENDER resueltos dejando los dos, sellos regenerados)

### Etapa B — Publicación privada (jugar en el sitio de verdad)
- ✅ B1. Inventario exacto de lo que el Worker tiene que servir (lo que hoy sirve `servidor.mjs`): programa
  (`mkw.js`, `mkw.wasm.br` con `Content-Encoding: br` y huella `?v=`), manifiesto del disco, pedazos (HTTP Range) del
  disco y de `RetroRewind6/`, semillas (`pipelines.bin`, `bloques.json`), imágenes; CORS solo el sitio
- ✅ B2. Programa final (`compilar-web.py --modo navegador --final`) y semillas nuevas (`guion.mjs … --semilla`, 3 corridas):
  700 pipelines y 233 bloques (§65). Se recompila con `--final` antes de subir (el gancho de §66 cambió el programa).
  **Rehecho en §89** con todo hasta §88: `build/web-final/navegador` (15,7 MB en brotli), 713 pipelines y 143 bloques;
  las 29 pruebas con ese programa 443/443 y el sitio entero (`prueba-experiencia`) 20/20 y `--playlist` 22/22
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
- ✅ M12. **La sala sin Retro WFC** (pedido del dueño: nada del Wi-Fi del juego, ni licencias ni título): `?modo=sala`
  — el juego arranca directo en la pantalla de personaje, la anfitriona arma la copa con el selector de la página, cada
  uno elige personaje/vehículo/derrape en el juego (45 s), cada carrera abre directo por código con la misma ficha en
  todas y corre en lockstep con los humanos como jugadores de verdad; al final la tabla al sitio (`sala-carrera.mjs`,
  banco `sala-carrera` 23/23, `prueba-sala` 20/20, §73). El sitio manda siempre `modo=sala` (copa o playlist, hasta 4)
- ✅ M13. **Todos largan juntos**: la carrera queda quieta en el primer cuadro hasta que llega el último, con el aviso
  «Esperando a que el jugador N termine de cargar la pista…»; al pasar a la carrera siguiente nadie queda trabado
  esperando botones de la anterior (banco `lockstep` 37/37, §73)
- ✅ M14. **Una sola vista por consola** (la pantalla salía partida): pantallas = 1 y locales = 1 al terminar la
  `RacedataScenario::Init` de RR; la foto lo comprueba (`foto-pantalla.mjs`; `prueba-sincro --directa` 13/13, §73.6)
- ✅ M11. Qué hace la sala cuando un jugador se corta: la carrera lo espera 30 s (margen, con aviso; **2 s desde §80**) y en nuestras salas
  nadie sale por inactividad (§73). Quien recarga se salta la carrera en curso (lo avisa: nadie lo espera) y vuelve en
  la siguiente con su puesto, lo que eligió y los puntos de la copa; si la que recarga es la anfitriona, pide la copia
  del estado a los demás (latido, `fuera`, `saltar`, `dame`/`copia`; banco `sala-carrera` 46/46 y `lockstep` 42/42,
  `prueba-sala --recarga` 27/28, §75)
- ✅ M15. **La carrera termina sola** (error que vio el dueño: si un humano no llegaba a la meta, no terminaba nunca):
  el tiempo límite del juego en línea (5:00; RR lo guarda en 0x818759B0), en el mismo cuadro en todas las consolas, y a
  quien no llegó el juego le da un tiempo estimado; nadie sale de la sala por quedarse quieto. **La copa con sus
  puntos**: el juego los suma una vez por carrera, la 2 se suma a la 1 y quien recargó usa la tabla de la sala
  (`prueba-sala` con B quieto en la 2: 146 puntos, §75)
- ✅ M16. **El reloj de los que faltan («DNF»)**, como en las carreras en línea de Mario Kart 8: cuando el primer
  corredor (humano o CPU, §78) cruza la meta, los demás tienen 30 s; al vencer, el juego les termina la carrera en el
  puesto en que van (en el mismo cuadro en todas las consolas) (`lockstep_nativo.cpp`, `prueba-sala`, §77). Y un
  contador en la página con los números de la cuenta de salida (`dnf.mjs`, `fuente-wii.mjs`, banco `cuenta-dnf`, §78)
- ✅ M17. **Un jugador lento no frena a los demás** (pedido del dueño, con un crítico): retraso de cada uno (2 a 12
  cuadros, ajustado con los informes de los demás), relevo por la autoridad (lleva en su paquete los botones del
  atrasado; si la lenta es ella, pasa el papel), corte en dos fases con quietud solo para quien se calla de golpe
  (margen de la sala 2 s), huella de los botones, avisos 📶 (`lockstep.mjs`; banco `relevo` 21, `lockstep` 42;
  `prueba-relevo` 10/10 con el juego, §80). §80b: la sincronía de tiempo (prendida; `?sincroTiempo=0` la apaga) y
  los cortes que se repiten (el aviso se perdía con la conexión caída). Queda: 12 jugadores (hoy 4 puertos)
- ✅ M8. Abrir directo lo que falta: Multiplayer → Local abre 2/3/4 Players y salta directo al registro de mandos
  (sección 0x54, con lo que hace el botón del juego antes: 0x808516BC; §84). Single Player ya abría directo su menú
  (0x48); desde ahí cada modo se elige con los menús del juego, sin piloto
- ✅ M9. CPU iguales a las de un jugador en la sala: los humanos son jugadores de verdad (tipo 0) y el nivel de la CPU
  sale de la cilindrada como en un Grand Prix (§73)
- ✅ M10. El menú «cambiar Mii» con los 6 Mii invitados del juego y sus imágenes del juego: el juego los dibuja en su
  primer menú y la página se los lleva a IndexedDB de ese navegador; «Mi Mii» los ofrece (nuevo o «Cambiar por un Mii
  invitado», que conserva el id de la licencia) y la licencia nueva usa el elegido (`invitados_nativo.cpp`,
  `invitados.mjs`; banco `mii-invitados` 41, `prueba-invitados` 13; §86)
- ✅ M18. (Pedido del dueño, 2026-10-20) **Entre carrera y carrera, como Mario Kart**: 30 s de descanso (antes 9) con
  un panel en las dos salas (la cuenta y cada humano con puesto, puntos y **VR**, que en la playlist no se veía);
  agregar o sugerir una pista con menos de 15 s por delante vuelve la cuenta a 15 s (la pausa de 60 s ya no existe); la
  **parrilla** de cada carrera es la llegada de la anterior (`+0xE1`, igual en todas las consolas, también en la que
  recargó); y el cerrojo de los botones: apretando A en los resultados el juego ya no abre su menú de «carrera
  siguiente» (que largaba otra carrera fuera de la sala). Banco `sala-carrera` 64, `sala-playlist` 37; `prueba-sala`
  35/35, `prueba-playlist` 20/20, `prueba-elegir` 69/69 (§94)
- ✅ M19. (Pedido del dueño, 2026-10-20) **El VR con el puesto general**: las CPU cuentan, como rivales de VR fijo
  (difícil 5000, normal 3000, fácil no cuenta), cada una 1/4 de un humano y todas juntas a lo más 2 humanos; entre
  humanos, la regla de MKW de siempre. Revisado por un crítico externo (equilibrio sin inflación, tope, anclas, la regla
  congelada en la foto de la carrera, puestos que no se pueden creer, la granja de cuentas alternas). Banco `vr-sala` 46;
  `prueba-sala` 35/35, `--recarga` 34/34, `prueba-playlist` 20/20 (§95)
- ✅ M20. (Pedido del dueño, 2026-10-20/21) **Las perillas de las CPU y una dificultad más alta, con el nivel como
  ajuste de la sala.** Catálogo de todas las perillas (decompilado: la velocidad base 70 + adv reemplaza la del
  vehículo; el elástico se mide contra la mejor CPU; el arrebato persigue al mejor humano; lo que depende del nivel en el
  código ya está al tope con la fila difícil; RR pone las maniobras al 100 %). Cuatro niveles de la página, más altos
  que los del juego (`dificultad-cpu.mjs` + `cpu_dificultad_nativo.cpp`, que envuelve la carga de las perillas y el
  reparto de objetos): fácil = su normal, normal = su difícil, difícil = a mitad de camino, **máximo = todo al tope**
  (base ×1,14 = el kart humano más rápido, sin frenarse, el arrebato siempre, sin tinta, objetos del humano; no el
  «Hard AI» de RR, que va a 120 y no se le gana). Medido con 12 CPU: fácil −6 %, difícil +8,4 %, máximo +14 % que
  normal. El nivel lo elige el anfitrión aparte de la cilindrada (sitio: fila «CPU» del vestíbulo, `{k:"nivel"}`,
  máximo por omisión). VR fijo por nivel: 3000/5000/7400/9400. Y el «Espejo» de la sala era el «100cc» de RR: ahora es
  espejo de verdad. Banco `dificultad-cpu` 21, `vr-sala` 47; sitio 19/19; `prueba-sincro --directa --cpu=maximo`
  13/13, `prueba-sala --cpu=maximo` 35/35, `prueba-playlist` 20/20 (§96)
- ✅ M21. (Pedido del dueño, 2026-10-21) **El vestíbulo de la sala, de nuevo, y las opciones de menos a más.**
  Cilindrada 150cc · Espejo · 200cc · Al azar y CPU Fácil · Normal · Difícil · Máximo. Tres maquetas (A parrilla de 12,
  B dos columnas, C ficha de carrera), un crítico aparte que las midió (C > B > A, ninguna tal cual) y su mezcla, la D,
  que eligió el dueño: la ficha de carrera con «¡A correr!» a la vista, las opciones detrás de «✎ Cambiar», los
  pilotos en dos columnas con su foto del sitio, corona, VR y «⋯» (pasar anfitrión, echar), «N de 12» con puntitos y
  una fila para la CPU; con la copa andando, una tira. Estilos propios del módulo (`juegos.html` no se toca). Sitio
  19/19; `prueba-experiencia` 20/20 y `--playlist` 22/22 (§97)
- ✅ M22. (Pedido del dueño, 2026-10-21) **El «Modo consola»: antes, durante y entre carreras.** Un crítico recorrió la
  sala entera y propuso 3 modelos; el dueño eligió el recomendado y agregó volver a elegir personaje y vehículo entre
  carreras, si uno quiere. El descanso es un zócalo de una línea abajo (la tabla del juego queda libre) y el ±VR de
  cada humano va escrito al lado de su fila de la tabla del juego, con la letra del juego (`letreros.mjs`); «Cambiar
  personaje y vehículo» (opcional) abre la pantalla de personajes y lo elegido corre desde la siguiente en todas; los
  nombres de la sala en el juego (globo y tablas: `nombres_nativo.cpp`, un Mii por casilla de humano y su nombre en cada
  carrera; las CPU con el nombre que les da el juego, y las skins de RR repartidas por la sala para quien recarga); el
  podio de 8 s al final; el cartel de quien recargó; los avisos por capas (📶 en una esquina); el reloj de 90 s de la
  copa; el modo inmersivo al empezar (opcional, apagado por omisión) y la precarga del vestíbulo con «⬇ 40 %» / «● listo» por piloto. Banco
  `letreros` 17, `nombres-juego` 15, `sala-carrera` 75; `prueba-sala` 42/42 (`--recarga` 38/38), `prueba-precarga` 8/8,
  `prueba-relevo` 10/10; sitio 20/20, `prueba-experiencia` 22/22 y `--playlist` 24/24 (§98)
- ✅ M23. (Pedido del dueño, 2026-10-22) **La red según el crítico, la carga de la sala, Intenso/Imposible y el VR por
  nivel.** Un crítico de la red (solo revisar) confirmó que compartir botones es el enfoque correcto y encontró cómo el
  lag de uno llegaba a los 11; el dueño dijo sí a todo. Hecho: la cortina con barra de progreso hasta que el navegador
  está en calma (la lista de copas ya no se traba), sin B ni START en la sala, el editor de Mii escondido; paquetes con
  acuse, TURN e ICE restart, la toma del anfitrión que desaparece, la largada pareja, la autoridad por estabilidad,
  **ponerse al día** (el runtime corre cuadros seguidos: `mkw_prisa`) y **el relevo rápido** (al callado se lo pausa a
  los 150 ms y vuelve a manejar); los niveles **Intenso** (el Hard AI de RR) e **Imposible** (además, solo las CPU: tope
  ×1,15, base ×1,15, aceleración ×1,5); el VR v2 (otro crítico: zona muerta, fusible, segunda llegada en los niveles
  fuera de escala, ausente = cortado); el «terminé» solo de un humano que corrió (S3). Medido: Intenso +10,5 % e
  Imposible +21,9 % de recorrido sobre Máximo (§99)
- ✅ M24. Los pendientes del dueño después de §99 y lo que quedaba del crítico de la red (§100, 2026-10-24): **la carrera
  pegada** al irse la anfitriona (la anfitriona provisoria a los 4 s si «se fue», 10 s si solo se calló; la oficial
  manda otra vez al volver; la carrera corta en 1 s al que se fue, antes lo esperaba 15 s al cargar); **el banco de
  desconexiones** (`prueba-desconexion.mjs`, 11 casos con el juego); **«Pedir copa»** (los demás piden, la anfitriona ve
  quién pide cuál y, si se le acaba el reloj, sale la más pedida); **los mandos como el resto de Juegos** (el `mando.js`
  del sitio dentro del marco: cursor en los menús de la página, el mando al juego en el juego); **H1.4** (los mensajes
  de la sala por otro piloto, también el latido), **H9** (el estado de la sala solo cuando cambia) y **H1.2** (la prueba
  de conexión 🟢/🛰/🔴/⏳ de cada piloto, en la tira del vestíbulo del sitio)
- ⬜ M25. (Lo que queda)
  - ✅ Afinar la red (§101, 2026-10-24): la espera en la traba de 1,5 s (lo normal es la pausa en dos fases, 34-322 ms
    según el retraso de B; las de 1,4-2,9 s eran C con el retraso bajado por los votos de B, que iba 80-120 cuadros
    atrás: quien va atrás ya no vota y nadie se frena por quien se pone al día solo; la traba propia mientras se espera
    ya no se le carga al otro) y el banco `relevo` §11 (compara la cuenta de estabilidad de la sala, `ratosMalos`).
  - Medir Intenso e Imposible en 200cc, con la velocidad de cada kart (¿se caen más a 138?).
  - La prueba de conexión también en el vestíbulo antes de empezar (necesita otra clave en el buzón y sus reglas de
    Firebase, que publica el dueño; ver §100.7).
  - ✅ Listo para el PR (§102, 2026-10-24): `main` juntado en la rama del sitio (conflictos de listas, la marca
    `@controles: teclado` que pide el Salón nuevo), la rama subida y el PR pedido a la sesión de la nube; el programa
    final compilado con sus semillas (729 pipelines, 483 bloques) y probado; la lista de R2 armada (7.324 archivos,
    5,00 GB). **Falta lo del dueño**: subir a R2, el Worker, las reglas de Firebase y `privado.json` (`docs/publicar.md`).
  - ✅ La PC justa que pide ponerse al día y no le sale (§102): «sé ponerme al día» solo si de verdad gana un 4 % en 3
    ratos; si no, los demás la esperan (`?alcance=0` = §101). Banco `relevo` §19.
  - La relevada que se queda más atrás que el retraso máximo (12) no vuelve a lo directo en toda la carrera (§102.6:
    A, al pasar la autoridad por lenta, quedó relevada y llegó a 68 cuadros atrás con su PC a 53-57 cuadros/s). Ver si
    conviene frenarse un poco también por la relevada que va poco atrás, o soltarla antes.
  - ✅ «🛰 Todo por Cloudflare» (§103, pedido del dueño, 2026-10-24): un ajuste de la sala, **apagado por omisión** y
    excepcional como en BT3, que manda todos los paquetes por el repetidor TURN de Cloudflare (`?conexion=cloudflare`,
    `malla.mjs` `soloRelevo`). Probado con un TURN de mentira propio (`herramientas/turn-local.mjs`). Con el modo
    apagado, **sin repetidor, ni de reserva** (§103b, el dueño: «como en el bt3»).
  - ✅ Menos llamadas al Worker (§104, pedido del dueño: «cloudflare son 100k calls por dia»): los pedazos del disco de
    a muchos en una llamada (`POST /mkw/lote`, `lote.mjs`), una sola pregunta previa cada 2 h y los videos con
    histéresis. 1.ª visita 1.392 → 123 llamadas, 2.ª 38 → 16. **El dueño vuelve a pegar el Worker.**

### Etapa C — En línea: terminarlo y endurecerlo
- ✅ C1. Elegir personaje y vehículo en la sala para la carrera sincronizada: con las pantallas del juego (§73)
- ✅ C2. Pruebas largas de "misma carrera": muchas copas sincronizadas con semillas y pistas al azar. La que se
  separaba (cuadro ~6100 de la carrera 1, semilla 3549642503) era el sorteo de reserva de objetos de Pulsar, sembrado
  con la hora de cada PC (`OS::GetTick` llamado); ahora da el reloj de la carrera (§83). Esa copa 4/4 y 4 copas al
  azar 16/16, ninguna separada
- ✅ C3. Red mala (latencia y pérdidas) en la carrera sincronizada con el juego: el retraso se adapta a la red (3 en
  esta PC, 6 con 70 ms de ida y 5 % perdido) y la carrera ya no va en cámara lenta (§70; banco 32/32, `prueba-sincro` 10/10)
- ✅ C4. El cuelgue ocasional al empezar la carrera (`Effects::Player::UpdateNonItemEffects`, 1 de 6 corridas): no volvió
  a salir en 18 corridas (§70) ni en la docena de §83–§84. Lo que quedaba (quien jugaba por primera vez se trababa
  5-9 s al largar y lo cortaban en el cuadro 20) se arregló en §93: margen de 15 s en los primeros 10 s de cada carrera
  (hasta 45 s si su página sigue contestando), y la malla ya no corta un WebRTC sano por un tirón (banco `lockstep`
  47/47, `red` 28/28, `prueba-sincro --directa --traba-largada=6000` 15/15)
- ✅ C5. PC lento en la sala (`prueba-sincro --lento`): la carrera sigue igual en las dos y va al ritmo de la lenta (por
  diseño, §62.3); ahora la página avisa quién frena («espera al jugador 2» / «Tu PC no alcanza») (§70.7; 11/11)
- ⬜ C6. VS en línea sin CPU: cola de pistas y «Confirmar» sobre la votación (F3); TURN, más jugadores, fallos en el chat (F4)
- ⬜ C7. Espectadores (video del anfitrión, como `bt3-directo.js`)
- ✅ C8. Dónde guarda Pulsar los trofeos y el VR: todo en la carpeta del mod (`Trophies/<crc32>/Trophy.pul` al batir al
  experto en Contrarreloj, `Ghosts/…`), que `guardado.mjs` ya copiaba entera; `RRRating.pul` es solo del en línea del
  juego, que la sala no usa (§90; `prueba-trofeos` 9/9)
- ✅ C9. (Pedido del dueño) hasta 12 humanos en la sala, como el Mario Kart en línea: los 4 primeros con su puerto y del
  5.º en adelante con el **mando virtual** de su puesto (el portador que usan la CPU y los remotos del juego), y dos
  derrames del juego con más de 4 locales arreglados (la lista de humanos de la IA e `InitScreens`); el sitio nace con
  cupo 12 (§91; `prueba-doce --n 5` 10/10, `--n 12` 11/11, `mkw.test` 18/18)

### Etapa D — Página y modos
- ✅ D1. Cilindrada (con 200cc de RR) y personaje en los modos de un jugador: en un jugador los eligen los menús del
  juego (RR muestra su 200cc); en la sala la «100cc» corría a 200cc (medido con el juego) y ahora se llama así (§84)
- ✅ D2. Imágenes sacadas del juego (fotos de pistas, copas, videítos, planos) a R2 con el programa (§74,
  `subir-r2.mjs`); las caras de los Mii van con M10
- ✅ D3. Quitar el visor de salas de Retro WFC (§64); el código de amigo propio ya sale del `rksys.dat` (`licencias.mjs`)
- ✅ D4. La ayuda de "tarjeta de video equivocada" en la página del sitio: ya estaba en el cajón (Avanzado → Video); ahora
  además aparece sola, abajo a la izquierda, cuando el juego va lento un buen rato por trabajo de esta PC y Windows elige
  la tarjeta («Ver cómo» abre la ayuda, «✕» la calla 7 días; `aviso-gpu.mjs`, banco `aviso-gpu` 18/18, §81)
- ✅ D5. (Pedido del dueño) sin portada: directo al juego; la cortina tapa la carga y los menús que recorre el piloto;
  escondidos «Retro WFC» (fuera de la sala en línea) y los «Settings» de Retro Rewind (§66; banco 11/11, `prueba-menus` 8/8)
- ✅ D6. (Pedido del dueño) menú de inicio «JloKart Wii» con su imagen, sin «Championship», **solo para los amigos** (la
  imagen sale del Worker con token + `AMIGOS`, como el disco de BT3; 401/403 = sin menú): Single Player → menú «Un jugador»
  del juego, Multiplayer → Local / Online (salas), Options → cajón; entrada «Mario Kart Wii · un jugador» (`#solo/mkw`) en
  el sitio (§67; banco 14/14, `prueba-inicio` 14/14, `mkw.test` 13/13)
- ✅ D7. (Pedido del dueño) la sala: la playlist arranca a todos (el selector de sugerir de los demás quedaba huérfano
  encima del juego); la sala nace con el máximo (4) sin preguntar «Pilotos»; el anfitrión puede **echar** y se puede
  **votar** (⏏, con 3 o más) en Mario Kart (§87; `prueba-experiencia` 20/20 y `--playlist` 19/19, `prueba-playlist`
  18/18, banco `sala-carrera` 49/49, `mkw.test` 17/17)

- ✅ D8. (Pedido del dueño) la Contrarreloj contra **el mejor fantasma de la página**: cada récord nuevo sube su `.rkg`
  a Storage y la pantalla de fantasmas pone el del primero de la tabla en lugar del experto (§92; banco
  `fantasma-pagina` 19/19, `prueba-fantasma` 10/10). **Las reglas de Storage nuevas las publica el dueño**

### Etapa E — Rendimiento
- ✅ E1. Sonido con AudioWorklet (§88): del juego al parlante **~177 → ~60 ms** medido con un clic (nuestra parte
  ~127 → ~20–25 ms; los otros ~40–50 son Chrome + Windows + la tarjeta, que una página no toca). Sin cortes en el
  título, el arranque ni la carrera (también con la CPU frenada 2×); `?audio=viejo` = lo de antes
- ✅ E2. Primera visita: los pipelines ya los resolvió la semilla (§65, §89); lo que quedaba era el disco: los ~600
  archivos diminutos van en un solo paquete (`diminutos.bin`, 1,5 MB, listos a los 6 s; antes, de a uno hasta los
  ~35 s). En el sitio local, de los menús a 20 s de carrera: 2531 → **1363** pedidos al Worker y **1 tirón** (29 ms)
  (§93; banco `disco` 38/38, `prueba-subir-r2` 23/23). Queda: una carrera abierta directo a los 15 s de abrir espera
  ~4,7 s al disco al largar (la largada de C4 lo cubre)
- ⬜ E3. Monitores de 60/120/240 Hz: recortar el giro final de 0,75 ms (medir con el monitor en 240 Hz)
- ⏸ E4. Celulares: **fuera del lanzamiento** (el dueño, 2026-10-19: «saltate el soporte a móviles para lanzar el juego más
  rápido, lo haremos en un futuro muy lejano en un próximo big update»). Entonces: teléfono real con `adb reverse`; misma
  carrera entre PC y teléfono (NaN en ARM). Hasta ahí, nada nuevo para teléfonos y sus fallas no frenan nada

### Etapa F — De fondo
- ✅ F1. Un script que corra todas las pruebas y diga "N bien, M mal": `herramientas/correr-todo.mjs` (§70)
- ⬜ F2. Banco que falta: disco y RR falsos, Worker local, juego falso chico
- ⬜ F3. Script para actualizar Retro Rewind (delta, retraducir `Code.pul`, recompilar, semillas, R2)
- ⬜ F4. Siempre: bitácora + glosario, `parches/` y `versiones.md` al día

**Terminado =** un amigo entra al sitio → Juegos → Mario Kart Wii → carga desde R2 por el Worker → juega a 60 fps;
sus partidas, récords y VR quedan en Firebase. Una sala de 2–12 corre (con CPU de relleno y ≤ 4 humanos, la carrera
sincronizada; si no, el VS en línea) sin separarse ni congelarse. Un no-amigo no ve el juego ni puede bajarlo. Nada
del juego en git ni público. Celular: fuera del lanzamiento, en un big update lejano (el dueño, 2026-10-19).

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
  - ✅ Cortes en el arranque y latencia (E1, §88): AudioWorklet (`sonido-worklet.js`, cola adaptable de 25 ms que
    arranca en 80) en vez del ScriptProcessorNode; ~60 ms del juego al parlante (antes ~177). Quedan cortes solo en las
    cargas de la primera visita (los dos caminos; los tirones de E2)
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
  carrera (§59). **Desde §82 se mueve con cada carrera de la sala** (pedido del dueño 2026-10-19): la regla de Mario
  Kart Wii entre los humanos, la misma que el juego en las 19 997 diferencias (`vr-sala.mjs`, `prueba-vr.mjs` 7/7). Falta:
  el dueño publica las reglas (`docs/firebase-mkw.md` §6)
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
10. **GPU equivocada**: en Windows el navegador elige la tarjeta (la página no puede). La página muestra cuál usa y ofrece, plegada, cómo cambiarla desde Windows; desde §81 lo ofrece sola cuando el juego va lento por eso (también en el sitio: es la misma página).
11. **La carrera de la sala pesa más que una sola** (§85): ~15 ms de CPU por cuadro en este Ryzen 7 9800X3D, contra ~9,5 ms de una carrera sola, por «todo a la vista» (§61) y «dibujar siempre» (§62), que la hacen igual en todas las consolas. Un amigo con un procesador ~30 % más lento pasaría los 20 ms y vería «Tu PC no alcanza». Salida posible, para la etapa de optimizar: dibujar con la vista de la cámara propia sin que la lógica vea distinto (cuidado: el dibujo escribe matrices que la lógica lee, §62).
6. **Online**: sin sockets UDP en el navegador; depende de infraestructura propia.
7. **Legal**: el `.wasm` y los archivos de RR nunca son públicos.

## Registro de avances

(Fecha y hora local de cada avance; el más nuevo arriba.)

- **2026-11-12 03:45** — §287.2: la auto calibración pausa en todos los modos: sin sala (Single Player, VS, Contrarreloj, GP, la sala de 1 humano) también congela la carrera con «⏸ Calibrando tu imagen»; en la sala, quien calibra también ve el aviso. Con v22: los 5 modos de una consola 10/10, la sala lockstep 52/52, «Cada uno su kart» las dos congeladas, la sala del sitio en los dos modos. Local 2-4 sin probar con el juego (en obra, sin el segundo mando). Banco 54/54.
- **2026-11-12 03:00** — **Medir en Opera GX y el cruce Chrome + Opera** (bitácora §289, pedido del dueño). `--navegador chrome|opera-gx|ruta` / `MKW_NAVEGADOR` en las 82 herramientas de Playwright (`herramientas/navegador.mjs`: el opera.exe de la carpeta de la versión, no el lanzador; perfil nuevo en %TEMP%). Medido con v22: Opera GX = Chrome (60/60, CPU 3,7–4,9 ms) en Single Player, en la sala de 1, en elegir personaje y en la sala de 2 cruzada Chrome + Opera, que anda. Arreglado: las fotos de los mandos ya no salen con una sola ventana (`mandos-ventanas.mjs`, banco 22/22; `?mandosVentanas=siempre` = antes), pero no eran la causa. Lo del dueño viene de su perfil de Opera o de su pantalla (3775×2014 a 240 Hz): falta su prueba en una ventana privada.
- **2026-11-12 02:20** — §287: la auto calibración en el sitio con v22: con el lockstep la pausa congela a todos con el aviso (prueba-sala 52/52, la sala del sitio 2/2 con el botón de verdad); en «Cada uno su kart» también congela (la prueba de §275b miraba tarde). Deja escritos los tres ajustes (Imagen, salida, fluidez). Banco auto-calibrar 53/53. Falta la sala del sitio en «Cada uno su kart».
- **2026-11-12 02:10** — **El «▶» del mando en pantalla abre el menú ⚙** (bitácora §286, pedido del dueño: en el celular el
  cajón no se podía abrir desde §269, `2ed4ae0`, porque el mando cubre toda la pantalla). Abre la Ayuda; en la sala no toca
  el juego; jugando solo, la carrera queda quieta mientras el cajón está abierto (`mkw_congelar`). `?pausaMenu=0` = antes.
  `prueba-celular` 48, `prueba-tactil` 14, con el juego `prueba-pausa-menu.mjs` 5/5 (v22). Falta la sala con el juego y el Oppo.
- **2026-11-12 00:25** — **W10 parte B: cerrada** (bitácora §284.5). En el Oppo, el dibujo sin salida da ×1,19 de lógica (×1,18 y ×1,20 en 2 pares; ~3–5 ms de aurora por imagen); el mínimo era ×1,25 y en este PC ~×1,0. Lo caro del dibujo es el código del juego. Nada se prende.
- **2026-11-12 00:15** — **W10 parte B, la puerta: no pasa en este PC** (bitácora §284.5). El dibujo del juego «sin salida» (aurora no traduce nada: `parches/aurora-w10b.diff`, `herramientas/tanda-w10b.sh`) cuesta lo mismo que con salida: 12,4 contra 12,3 ms por cuadro a 60 de verdad; el techo sin 3D da 9,7. El costo del dibujo es código del juego, así que el diseño de la invariante ahorraría como mucho lo de aurora (~8 % en el Oppo): no se construye. Falta confirmarlo en el Oppo (no estaba conectado): `W10B_VAR_TEL=base,w10b bash herramientas/tanda-w10b.sh telefono`.
- **2026-11-12 03:37** — **Auditoría de lo que calza: las dos funciones de `carrera-local` pasan** (bitácora §296, pedido por la sesión principal). Se auditó `f01fd6e` en una copia limpia (`terceros/mkw-decomp-auditoria`): `GXCallDisplayList` y `sqrt` de `Math<float>` pasan las cinco pruebas (compilación desde cero con SHA-1 bien, 100 % propio, C real, la vara sin mover, nada roto; 1.830 calzan). `herramientas/decomp-auditoria.json` anotado (ok 2, rechazadas 0); tablero republicado en el mismo enlace (v6). Incidente: ninja bajó `dtk` y `objdiff` (mismas huellas que la copia de trabajo). `rotateVector`/`rotateVectorInv` no están al 100 %: fuera de la auditoría.
- **2026-11-12 03:45** — **Decompilación que calza, lista para empezar** (bitácora §292, el dueño autorizó los compiladores originales). El proyecto público armado en `terceros/mkw-decomp` compila aquí y da lo mismo que decomp.dev (1.828 de 26.501 funciones calzan). El tablero lee el informe de objdiff; `herramientas/decomp-base.json` = lo que ya calzaba. De las 1.614 funciones de la carrera, 134 ya calzan en público (0,537 ms por cuadro, 14,6 %); nuestras 0.
- **2026-11-12 03:25** — **Las herramientas de decompilación, bajadas y sin usar** (bitácora §290, pedido del dueño; no se empezó nada). El mapa público al día (`doldecomp/mkw` @ 8b9b5ee), dtk v1.8.4, objdiff v3.8.3, sjiswrap, Ghidra 12.1 + cargador de GameCube, m2c, decomp-permuter, asm-differ, asmlift, mizuchi, kappa, decomp.wtf, dtk-template y ogws; huellas comprobadas; versiones en `herramientas/versiones.md` §290. **No se bajaron los compiladores originales (CodeWarrior): decisión del dueño.**
- **2026-11-12 03:05** — **El tablero de la decompilación** (bitácora §289, pedido del dueño; no se decompiló nada). El total se mide en bytes de código: 26.353 funciones conocidas en 6.025.164 bytes; `StaticR.rel` 100 % con dueña, `main.dol` 98,5 % (36 KB en 31 huecos). En la carrera: 1.614 funciones del juego, 3,669 ms por cuadro; hecho 1 función (§280) = 2,17 % del tiempo. `node herramientas/decomp-avance.mjs` + `herramientas/decomp-estado.json` → artifact privado.
- **2026-11-12 02:50** — **Nada se baja en la carrera y la sala larga junta con todo bajado** (bitácora §285, pedido del dueño). El paquete de carrera trae ahora la música de la última vuelta (la del cartel de Lakitu de la vuelta 3), las fanfarrias enteras y la voz _PC de la skin de cada CPU: una carrera entera de 3 vueltas en la 13.2 con perfil nuevo = 0 pedidos a la red de la cuenta a la meta. En la sala cada consola se queda quieta en el primer cuadro, con el aviso «Esperando a que todos carguen la carrera… Faltan: X N %», hasta que todas tienen el paquete al 100 % (tope 90 s) y parten a la misma hora de la sala (`?esperarPaquete=0` = antes). Bancos `sala-carrera` 111, `paquete-carrera` 59; `prueba-sala --rapida` con 80 ms de red 44/44. Falta verla con una consola lenta para bajar y con el teléfono. No cambia el `.wasm`.
- **2026-11-11 22:40** — **W10 parte B, segunda vuelta: la nota de diseño** (bitácora §284). §247 no cierra la puerta: comparó la base sin tope (que casi no dibuja) contra el par que dibujaba todo y esperaba a B. El dibujo malo de B venía de que A no dibujaba. Diseño nuevo: A corre el dibujo «sin salida» (GX no le pasa trabajo a aurora) y la caja va al empezar cada dibujo; B deshace lo suyo antes de pegar, así su memoria es la de A antes de cada dibujo (la invariante), y si B se atrasa las cajas se acumulan. Cuentas del Oppo: lógica ≈ 8 ms y dibujo ≈ 13,4 ms por cuadro. La puerta, todavía sin medir: A sin salida ≥ ×1,4 de lógica en el Oppo. Sin código: el uso semanal llegó al tope.
- **2026-11-11 20:58** — **La autoridad de la sala ya no se pasa el papel de ida y vuelta** (bitácora §269b.18–20). Con el freno de la cuadrícula la autoridad contaba como lentitud los cuadros que no corría por frenarse a propósito por el teléfono y pasaba el papel; el otro PC hacía lo mismo (24 cambios en 60 s). Ahora resta sus frenos propios (`?lentaPropia=1` = antes). Y con el árbitro el que no es autoridad se frena recién desde 3 cuadros delante (antes desde 2: un desfase de la medida, un cuadro repetido cada medio segundo; `?umbralSincro=1` = antes). Bancos `relevo` 81, `lockstep` 61. No cambia el `.wasm`. Falta confirmarlo con el Oppo (la sesión de los picos) y la ronda del simulador de noche.
- **2026-11-11 21:40** — **Las caídas de la sala con el teléfono, sin cerrar** (bitácora §269b.17). Con el Oppo el freno de la cuadrícula no gana ni pierde (4 pares). Tres patrones de caída: el cambio de autoridad (la nueva se frenaba 35–60 cuadros de una → no persigue al que ya va más de 30 atrás hasta medirlo, `?frenoLejos=0` = antes; no se ejercitó con el Oppo), el desfase fijo del teléfono (restar la base, `?frenoBase=1`: medido, empeora, apagado) y el que no es autoridad frenándose por un desfase de 2 (sin arreglar). Para medir de noche con el PC libre.
- **2026-11-11 17:55** — **El freno de la sala no frenaba y la isla que sigue no es la desincronizada** (bitácora §269b.15–16). (15) `tormenta`: la sala se parte 3 contra 1 y sigue la isla grande, bien; las que siguen ya no quedan «desincronizadas» (`separadoDe`, `?islaMarca=0` = antes; banco `lockstep` 61); el simulador ahora guarda las líneas del lockstep (3632b77). La espera fina desde 2 cuadros detrás: medida, empeora (atrasa el registro del mismo lento): apagada, `?esperaFina=N`. (16) La sesión de los picos: el PC autoridad frenó 564 cuadros en 40 s y la sala bajó 46: la cuadrícula de retrazados de `vi.cpp` es absoluta y deshacía cada freno corriendo de golpe → `mkw_frenar(ms)` corre la cuadrícula (25de095 en la copia `-w30-403s`, `parches/motor-w30-403s-frenar.diff`), `?frenoReloj=0` = antes; `prueba-sincro --lento` 61 frenos en vez de 181 (5859f0e, **cambia el `.wasm`**). Falta el veredicto con el Oppo; el simulador de la tarde, demasiado ruidoso para cerrar `uno-lejos`/`uno-lento`/`seis-mixtos`.
- **2026-11-11 21:10** — **N8 en el teléfono, el perfil del Oppo y la tabla de hoy** (bitácora §283.9). N8 se apagaba en el teléfono en «Cada uno su kart»: la prueba de «no mejora» no sirve en el modo 1 (3f95c21, `?n8Prueba1=1` = antes) y al largar soltaba lo de elegir personaje (c96bcb2: ahora solo los PC); en el Oppo, 2 de 2 corridas con N8 prendido los 61 s. El perfil de 50 s del Oppo con nombres (`perfil-pesados-283.mjs`): ninguna función culpable (la mayor 2,3 %, las 100 primeras 44 %), una imagen tarde son dos tareas pegadas y la normal ya pide 36 de 33,3 ms → hace falta W10 parte B o el motor. Lockstep: los colapsos de los PC vienen de los cambios de autoridad (sesión de los bugs). El PC bajó de 93-95 % a 82-85 % desde las 19:00 con el mismo programa y la misma página (A/B): algo del PC.
- **2026-11-11 18:55** — **«20 parejas» en el Oppo** (bitácora §283.8; el dueño: «Sí, pruébalo»). N8 modo 3: calcula tres cuadros y dibuja uno (20 imágenes/s, lógica 60; `?n8=3` o Avanzado → Gráficos; cambia el `.wasm`, `build/web-283`). En 8.3 con el Oppo, pares intercalados: los picos «sin pista» bajan de ~70 a ~7 por minuto, pero la Imagen solo pasa de 71-74 % a 72-77 % y el Juego de ~60 % a ~70 %: no llega al 90 % y son 20 imágenes. Queda manual; Automático no lo elige. Arreglado en `sala-telefono-mixta.mjs`: el `n8` pedido le gana al `&n8=auto` de la herramienta (antes la página leía el primero). Bancos graficos 75, n8 33, imagenes-vista 26.
- **2026-11-11 17:20** — **Los picos: la confirmación** (bitácora §283.7). Los arreglos de la sala de verdad en 0 en «Cada uno su kart» (c58b530: la página ya había cambiado `red=estado` a `malla`; Oppo 64 → 71-73 %, picos 185 → 63-80 por minuto). N8 prendido en elegir personaje ya no pasa a la carrera (0f954dc, `?n8MenuPasa=1` = antes): dos PC lo arrastraban y su Imagen caía a 59 %. En 8.3 con 2 PC + Oppo, los PC cumplen en las dos salas (lockstep 91 %, Juego 99-100 %); el Oppo queda en 71-74 %: falta procesador (W10 parte B o el motor).
- **2026-11-11 15:45** — **El cartel de la carga en el Oppo** (bitácora §276b). Las fotos de la 1.ª visita en el teléfono de verdad (marco seguro): «Bajando el juego… 23 MB de 27» → «Arrancando el juego…» → «Preparando gráficos: 95 de 175 (te faltan ~3 s)» → «Casi listo…», con «trabajando · N s» (`build/vistas/cartel-oppo-*.png`). Arreglado lo que mostró el Oppo: quien tocaba Single Player apenas salía el menú de inicio veía ~6 s el arranque del juego sin cortina; ahora la espera de los gráficos es dueña de la cortina y sigue hasta que el juego está en pantalla (el menú «Un jugador» a los 10,0 s, antes 11,4). `prueba-tactil` 14, `prueba-inicio` 15. **El .wasm no cambia.**
- **2026-11-11 15:50** — **Los picos en el PC y en el Oppo, con los dos gráficos** (bitácora §283; el dueño: «que el 1 % low tenga menos de 10 % de variabilidad»). (1) El «Juego» del medidor se medía al TERMINAR cada cuadro: el ancho variable del trabajo salía como tirón; ahora al EMPEZAR (`envolverEsperaJuego`, `?ritmoJuego=fin` = antes): PC Single Player en 8.3 Juego 87 % → 100 %, Imagen 95 %. (2) N8 Automático se apagaba para siempre en la sala: la prueba «no mejora» comparaba elegir personaje con la largada de 8.3; ahora solo el mismo lugar (`?n8MismoLugar=0`, VERSION_PRUEBA 283): el Oppo en «Cada uno su kart» había quedado con lógica 37 e Imagen 35 %. (3) En «Cada uno su kart» los arreglos del lockstep sobraban: con `&arreglos=0` los picos del Oppo bajan de ~200 a ~66 por minuto (Imagen 64 → 70-73 %, pares intercalados); lo cambia red-estado. (4) El Oppo en el Single Player: la traza muestra el hilo del juego ocupado todo el rato en cada imagen larga (pares de 37-55 ms con 33,3 disponibles), no un pico de la página: falta procesador (W10 parte B o el motor); se calienta y va más lento (50 → 44 de lógica con 1 °C). PC: Single Player y «Cada uno su kart» cumplen; lockstep con el teléfono (espera-sala) es de la sesión de los bugs. Herramientas: `tanda-283.sh`, `resumen-283.mjs`. Bancos imagenes-vista 26, graficos 75, n8 31. Commits 2e64cbf y este.
- **2026-11-11 15:30** — **El cartel de la carga y las pruebas con el juego de §276** (bitácora §276b y §276.4; el dueño: «que el usuario no crea que está pegado en preparando gráficos»). La cortina dice la fase con su avance («Bajando el juego… 34 MB de 80», «Compilando el programa…», «Preparando gráficos: 101 de 175 (te faltan ~2 s)», «Casi listo…»), un puntito que gira con los segundos y, si una fase pasa 15 s sin avanzar, «Esto tarda más en algunos teléfonos, sigue cargando» (`cartel-carga.mjs`, `?cartelCarga=0`). Banco `cartel-carga` 25/25, fotos en este PC (`foto-cartel.mjs`). §276 con el juego: `prueba-navegador` 22, `-precarga` 8, `-celular` 44, `-tactil` 14 y `prueba-sala --rapida` 44. `prueba-navegador` ahora espera que termine el arranque de prisa antes de medir los cuadros parejos. Falta la foto en el Oppo. **El .wasm no cambia.**
- **2026-11-11 15:15** — **La sala: lo que encontró la planilla, el juego que se caía y el reloj que no espera a nadie** (bitácora §269b.10–14). (10–11) `tormenta`: los avisos tardíos de otra isla no valen; la espera corta de la autoridad (`?esperaCorta=1`, apagada por omisión). (12) La planilla con `web-final-v21`: `sala-doce` a 22/s era el freno siguiendo a un teléfono simulado de 20 cuadros/s → el piso del freno (`?frenoPiso=N`, 40) y los PC vuelven a 59,4; `caida` 7/7 (el medidor tapaba la franja); el informe §269 pide el local solo en la directa (6c7d8f0). (13) El piso se mide solo mientras ese va atrás, deudas chicas de a un cuadro y la vigía de N8 no se prende por la sala (a8f63a6); el juego que se caía en el cuadro 482 (una animación de Pulsar con +0x28 = 0x80274A40, un dato) → la guardia en `fn_80059550` y `AnmObjTexPatRes::UpdateFrame`, la carrera fija 14/14 con huellas iguales (635334d, **cambia el `.wasm`**). Con el Oppo: la largada pareja ✓ (165 ms), los PC no esperan al teléfono en la carrera, los inventados son los tirones del teléfono. (14, el dueño) Ningún reloj de la sala corre hasta que todas las consolas cargaron: «⏳ Esperando a los jugadores… (faltan: …)», tope 90 s, `?esperarCarga=0` = antes (436a477; banco `sala-carrera` 107, `prueba-sala --carga-lenta-b=20` 46). Siguen sin cerrar: `tormenta`, `uno-lejos`/`uno-lento` hacia 5 %, `seis-mixtos`.
- **2026-11-12 00:45** — **Las llamadas indirectas con contrato: no rinde** (bitácora §282, la idea de §280). El traductor `MKW_IND` (copia `terceros/Wiicompiled-motor-ind`, `parches/motor-ind.diff`): la unión demostrada de los destinos posibles de cada `bctrl` (17.298, de la imagen, del código y de RR) necesita el estado completo (2.516 destinos ya lo necesitan solos) y la cerca se contagia igual. El techo optimista sin demostrar baja las funciones con cerca de 15.722 a 4.116 y las lecturas de `ctx` un 8,8 %, pero no gana: Node ×0,995, Chrome en este PC +0,5 / +1,0 % (la puerta era +5 %). **No se construye la versión por sitio**; el programa no cambia. `bash herramientas/tanda-282.sh …`.
- **2026-11-11 14:05** — **La sala con el teléfono de verdad: por qué va peor que el Single Player** (bitácora §281 parte 2). `herramientas/sala-telefono-mixta.mjs` + `tanda-sala-telefono.sh`: 1–4 PC y el Oppo real por el marco seguro, con un registro por imagen y la causa de cada pico de más de 25 ms (espera de la sala, ponerse al día, pipeline, disco, recolector, N8, paquetes), traza y perfil de CPU. El teléfono no entraba por estar en otra subred: va por el cable (`adb reverse` + el repetidor de mentira con **TURN por TCP**, banco `red` 42). La causa n.º 1: la vigía de N8 apagaba N8 para siempre en la sala (lógica de toda la sala a 53, picos ×10–20), arreglada por red-estado y bugs. Con a8f63a6 (4 PC + teléfono): lógica 58,5 en todos, pero los PC aún esperan ~10 % al teléfono (95 % de CPU en la sala contra 89 % solo). `herramientas/recta-largada.mjs`: la recta de largada más larga, sin contar cañones (8.3 N64 Rainbow Road, ≈548 m).
- **2026-11-11 06:40** — **El simulador de sala mixta** (bitácora §281; el dueño: «simule mejor el multiplayer tipo distintos PCs, lag» y «algunos con 30, algunos con 60, algunos con N8»). 2 a 6 jugadores en este PC, cada uno con su Chrome, su CPU (×1–×4), su red (`?redSim`: bajada/subida aparte, pérdida, ancho de banda, picos, corte y cambio de red), sus gráficos (N8 0/1/2/auto, salida, fluidez, efectos) y 60/144 Hz; 9 escenarios con semilla en lockstep y «Cada uno su kart», host y Cloudflare (`bash herramientas/tanda-sala-mixta.sh`). Gráficos mezclados = la misma carrera. Fallas reportadas: lockstep, la sala entera «fuera» con el corte de un jugador y muchos inventados con un lento (a bugs); «Cada uno su kart», el lento que no se ponía al día (red-estado ya lo arregló: 2 cuadros). Con 12 humanos: «Cada uno su kart» ~105 kbit/s por jugador; la autoridad del lockstep ~1,5 Mbit/s. Banco `sala-mixta` (51).
- **2026-11-11 08:21** — **Lo que encontró el simulador de sala, arreglado en el lockstep** (bitácora §269b.8–9; el simulador de otra sesión, §281). (8) El lento que va y viene: el «no alcanzo a ponerme al día» vale 10 s, el freno cobra hasta 3 cuadros, se rearma con un informe, espera el botón del lento en cada cuadro, descuenta media ida y vuelta al lejano y no espera al trabado: `uno-lento` pasa de 46/51 % de botones inventados a 11–41 % según la carga del PC (la meta del 5 % sigue pendiente); el 📶 con el árbitro mira a quién se le inventan los botones 2 s seguidos: `parejos` 14/14. (9) Un corte de red ya no saca a toda la sala: los avisos de pausa/corte de quien vuelve de un silencio esperan la decisión de las islas (`?retener=0` = antes) y el que quedó solo se sale si los que cortó siguen juntos: `se-va-y-vuelve`, A y B siguen y solo C se sale (antes, las tres fuera). `tormenta` (cortes parciales) sigue sacando a todas: trabajo aparte. Bancos `relevo` 81 (casos 26 y 27 nuevos), `lockstep` 60, `red` 38, `sala-carrera` 101; en el PC con `build/web-final-269b`, sala 44/44 y sincro 16/16. **No cambia el `.wasm`.**
- **2026-11-11 01:55** — **La sala va al ritmo del lento y el «azar» del teléfono era del dibujo** (bitácora §269b.5–7; el dueño: «el PC le gana por 2 segundos»). (5) Con el árbitro la autoridad no se frenaba por nadie: medido en el Oppo, el PC llegó a ir 685 cuadros (11 s) delante. Ahora se frena un cuadro en cada cuadro mientras va más de 6 delante de un jugador que sigue mandando y no puede ponerse al día (`esperaVivo`, `?esperaVivo=0` = antes). En el Oppo (`build/web-269n`): carrera 1 el PC va 4–14 cuadros delante (media 7), huellas 78/78; el castillo 9–24 (media 17), 152/152: queda para afinar. (6) La «parte distinta» del azar en el teléfono es el azar 2 (Raceinfo +8), que en la carrera solo mueve la animación de los pilotos (avanza con el dibujo): sale de la huella ampliada (el volcado lo sigue mostrando). Darle a la animación su propio azar (bit 64) se probó y se descartó: una pestaña quedaba a 15 s por cuadro y una vez colgada en «FINISH!» (sin él 44/44, con él 42/44). (7) El relevado que va más de 600 cuadros detrás de la autoridad se sale de esa carrera y vuelve en la siguiente (`muyAtras`, `?cortarTarde=0` = antes): en la corrida descartada el teléfono corrió 90 s atrás con 11.298 cuadros inventados. Bancos `relevo` 76 (casos 24 y 25) y `lockstep` 60. La sala con el teléfono y el punto 7 quedan para cuando el dueño vuelva a conectar el Oppo. Programa final `build/web-final-269b` (**cambia el `.wasm`** desde §269b; lo sube el dueño a R2).
- **2026-11-11 01:20** — **El arranque rápido en el celular** (bitácora §276; el dueño: «debe ser rapidísimo»). Hasta el menú «Un jugador», el Oppo real pasa de 21,4/21,6 s a **8,2/8,0 s** (1.ª/2.ª visita) y este PC de 5,97/5,05 a **3,65/2,96 s**. Cuatro cambios: en el teléfono el precalentado compila 8 a la vez (antes 2) y la espera de los menús pide un cuarto de la lista (antes la mitad); el arranque invisible corre de prisa, sin esperar al monitor; y el manifiesto, la tarjeta y el programa van en paralelo (`compileStreaming`). Los karts, los efectos y la lógica a 60 no cambian. Hay un instrumento nuevo, `arranque.mjs` (`medir-arranque.mjs`, `arranque-telefono.mjs`). Bancos: `arranque` 17, `preparacion` 30, `disco` 56. **Falta la prueba con el juego** (`prueba-navegador`, `-precarga`, `-celular`, `-tactil`, `prueba-sala --rapida`). **El .wasm no cambia.**
- **2026-11-10 21:55** — **El PR #403 de WiiCompiled pieza por pieza** (bitácora §277). Cada pieza del PR («port perf fixes from forks») quedó en nuestra copia de W30 con su interruptor y se midió. **Adoptado:** el traductor que escribe de vuelta solo los registros sucios (la mitad de las copias; el wasm baja de 109,6 a 102,6 MB) más `MKW_MOTOR_PR403=62` (tabla hash de las indirectas, DVD en bloque, XF en lotes, arreglos por la página, cubetas del EFB). La pieza del NI no hace nada con W30. La carrera es la misma: sincro contra el publicado 16/16 y fantasma 2115/2115. En el **Oppo real** gana **+8,1 %** de lógica/s (pares +8,7 / +7,4 %); en Node −5 %. Copia `terceros/Wiicompiled-motor-w30-403s` (`0f3cd27`), `parches/motor-w30-403*.diff`, `tanda-403.sh`, `tramo-telefono.mjs` (nuevo). `tanda-cierre.sh` arma ahora desde esa copia. **El .wasm cambia**; falta el final con PGO.
- **2026-11-10 20:25** — **«Cada uno su kart», parte 2: las CPU de la anfitriona** (bitácora §275b). La anfitriona corre las 10 CPU y manda su registro RACEDATA de 64 bytes en lotes por la malla (a cada CPU se le arma a mano la «fábrica» que el juego solo crea para personas); en las demás consolas las CPU son karts remotos de la anfitriona (`GetRacedata` envuelto). Dos pestañas **9/9**: las 10 CPU a ~3,7 m entre las dos pantallas (antes ~200 m: cada consola corría las suyas), 60 de lógica, el botón propio en 0 cuadros. Falta: 3c, el sitio, el lento al día, el teléfono y la copa entera. **Cambia el wasm** (`build/web-275`).
- **2026-11-11 00:40** — **«Cada uno su kart», parte 3: el fin de cada carrera y los puntos** (bitácora §275b). El árbitro de la carrera VS común en vez del de la en línea (que esperaba a Nintendo); cada consola avisa la llegada de sus karts en el mismo cuadro (`[0xA9, 0xFD, máscara, ms…]`) y las demás los terminan con ese tiempo (`EndRace`); el juego cuenta como humanos también a los de la otra consola (`mkw_red_estado_humanos`). Dos pestañas, 2 carreras: **21/21**, los mismos puestos, tiempos y puntos en las dos. Los tirones del medidor no se reprodujeron (el perfil no muestra nada de red-estado; 60 s: lógica 59–61, 2 imágenes > 25 ms). Falta el resto del 3c, el sitio, el lento al día y el teléfono (desconectado por el dueño). **Cambia el wasm** (`build/web-275`).
- **2026-11-11 05:40** — **«Cada uno su kart», parte 4: varias consolas, la que se va, el VR con las CPU y el lento al día** (bitácora §275b). Probado con 3 y 4 consolas (`prueba-sala-estado-n.mjs`): **11/11** y **12/12** (una se va a los 5 s: el respaldo le da el mismo tiempo en todas, el VR la corta y en la carrera siguiente su kart lo corre la anfitriona como CPU). La dificultad de la CPU de la sala también en el modo 7 (antes el VR no contaba las CPU). El lento al día (pulso 0xFC + `mkw_prisa`): en el simulador §281 el adelanto final de 315 a 1–2 cuadros, las CPU 3,6 m después de un corte de 8 s. La red: la anfitriona sube ~40 KB/s con 3, ~70 KB/s en el peor caso (6–7), 27,5 KB/s cada una con 12 humanos. **Cambia el wasm**.
- **2026-11-11 07:30** — **«Cada uno su kart», parte 5** (bitácora §275b): la recarga a mitad de carrera **11/11** (el respaldo solo termina karts de una consola que se calló: antes cortaba también las CPU de la anfitriona); «⚡ Auto calibración» sin pausar a nadie (no hay lockstep); **6 consolas con una que se va 12/12**. La red corregida: cada consola sube ~5 KB/s de su kart en total (el juego manda a una consola por cuadro, en ronda); la anfitriona sube como mucho ~64 KB/s con las CPU. La opción «Modo de red» en el sitio, en la rama `mkw-red-estado` (sin PR; `mkw.test.cjs` 26/26). Ideas para el aparato que no llega a 60, sin hacer. **Cambia el wasm**.
- **2026-11-11 19:15** — **«Cada uno su kart»: los karts de afuera con el modelo liviano** (bitácora §275b, d4eb4b7, **cambia el wasm**). El modelo de cada kart lo decide un byte de la carrera (Racedata+0x27 = humanos locales): en este modo daba el completo a los 11 de afuera. Ahora se arman con el `_4`, como las CPU de la pantalla partida (`?kartLiviano=0` = antes). PC 12/13, la misma carrera; el Oppo en 3 pares: lógica 50,5 → 54,8/s (+8,5 %), imágenes 31 → 34. Falta: otros ~5 ms del teléfono (la lógica de la carrera y los efectos contra el Single Player) y los trajes de RR de las CPU.
- **2026-11-11 15:36** — **«Cada uno su kart» con el teléfono de verdad** (bitácora §275b): PC + Oppo **13/14** por un repetidor propio por el cable (`prueba-sala-estado --telefono`: el teléfono por WiFi y la PC por cable no se encontraban). Mismos puestos, puntos, tabla y VR; el botón propio en 0 cuadros (la planilla daba 2: era la medida). El que va atrás se pone al día de a poco (`?alDia=viejo` = todo de una vez) y el atraso se cuenta con los cuadros corridos. N8 Automático ya no se apaga en el teléfono. Sin los arreglos de la sala por omisión (§283: en el Oppo el 1 % bajo pasa de 64 a 70–73 % y los picos de ~200 a ~65 por minuto). Falta: el teléfono no llega a 60 de lógica en este modo (~51). Solo la página: el `.wasm` no cambia.
- **2026-11-11 08:40** — **«Cada uno su kart», parte 6** (bitácora §275b): playlist **11/11**, el que llega con la copa andando corre desde la siguiente (todo igual en las 3), **10 consolas 7/7** (12 no entran en este PC: 768 MB cada juego). Falta el teléfono (desconectado), y al final PGO y comprimir.
- **2026-11-11 08:30** — **Decompilar contra traductor** (bitácora §280). `KColData::checkSphereMovement` (0x807C0884, 1,7 % del cuadro, ×5 contra nativo) reescrita a mano (`terceros/decomp-propio`, fuera de git): **idéntica** (0 diferencias en 400.000 llamadas, fantasma 2.115 cuadros iguales, sala 74 huellas contra el publicado) y ×2,9 más rápida por llamada, pero el cuadro no cambia (mismo programa con `?decomp=0/1` en Chrome: ×0,994): **no se sigue decompilando**. El prototipo del traductor (contrato común para `VWarning`, `parches/motor-eval-abi-comun.diff`) casi no cambia el C++: ≈ 0. Lo que escala: contratos probados también en las indirectas (40 % del tiempo detrás de esa cerca). `bash herramientas/tanda-decomp.sh …`.
- **2026-11-10 19:40** — **«Cada uno su kart», parte 1: la carrera en línea abierta por código, sin Retro WFC** (bitácora §275b; el dueño aprobó §275 como nueva opción del multijugador). Un «DWC falso» (`web/juego/red_estado_nativo.cpp` + `web/navegador/red-estado-sala.mjs`) reemplaza lo que la carrera en línea le pide a DWC: los paquetes RACE van por la malla de la página y las preguntas («¿cuántos somos?, ¿quién soy?») las contesta la sala. Con `?red=estado&modo=sala`: modo 7, los otros humanos en línea, el kart propio con el mando 0 y sin lockstep. Inerte sin la página (prueba-sincro con y sin las envolturas en la misma sala: huellas 75/75). Dos caídas arregladas («RMCP» = los datos de usuario de DWC que sin Wi-Fi no existen: `UpdateSubsAndVR` y el paquete USER ya no se llaman). Dos pestañas: **8/8** (60 de lógica las dos, 12 karts, el botón propio en 1 cuadro, el kart del otro a 1–4 m sin atraso; `herramientas/prueba-sala-estado.mjs`, con plazo de 60 s). Falta: 3b (las CPU de la anfitriona), 3c (todo lo de la sala), la opción en el sitio, el lento al día y el teléfono + la copa entera. **Cambia el wasm** (`build/web-275`, sin PGO por ahora).
- **2026-11-10 16:55** — **La sala contra el Single Player en la gama baja** (bitácora §269b; el dueño: «el multiplayer corre muchísimo peor que el singleplayer»). (1) La mitad del 20 % era la medida: con otro juego en el mismo PC, el Single Player pierde ~28 % (la medida de control `etq@2c`; la comparación intercalada en una vuelta del candado, `tanda-269.sh barrido`). (2) La sala dibujaba una pasada y dos copias de más por imagen: «dibujar siempre» reemplazaba la compensación de lag de RR entera (`rr_kamek_81806568`); ahora corre la de RR y solo fuerza el cuadro (26 pasadas y 4 copias, como el Single Player). (3) La sala no tenía compensación de lag en un aparato lento: cuando RR quiere saltarse un dibujo, se salta como N8, sin separar la carrera (+45 % de lógica en la sala de la gama baja: 10,8 → 14,4 · 9,7 → 15,3; huellas iguales también con una consola lenta). `?arreglos=N` (máscara, 63 por omisión; 15 = antes). El teléfono de verdad por el marco seguro: la pantalla prendida devuelta exacta, `prueba-sala-telefono.mjs` con un piloto automático que sigue la ruta de las CPU (derrapes, objetos, frenadas, choques); Single Player 44,9 img/s · sala 30–31 (huellas iguales, nada pegado). Falta: medir el adelanto del PC sobre el teléfono («el PC le gana por 2 s», ya instrumentado; esperando el candado tras §275), la regresión con 63 y compilar el final. **Cambia el wasm** (`lockstep_nativo.cpp`, `n8_nativo.cpp`, `semillas_nativo.cpp`): falta compilar `build/web-final-269b` → R2 (el dueño).
- **2026-11-10 14:30** — **Elegir personaje en la gama baja** (bitácora §273, después de §270). El perfil de la CPU muestra que la página de la sala no frena (menos del 1 %): la CPU está saturada (4 % desocupado). Dos arreglos de la página: el precalentado de pipelines se pausa también en elegir personaje cuando N8 está prendido ahí (`?pausaPersonaje=0`; en un PC que llega a 60 no entra, porque ahí atrasaba lo que la pantalla necesita); lo pendiente se arma en la carga de la carrera; y Automático usa «30 parejas» en esa pantalla (`?n8MenusModo=2`). Gama baja con la sala: el 1 % bajo de las imágenes de 6–7 a 18 y la lógica de 48 a 52/s; sin la sala, la lógica de 56 a 58–60/s. Este PC igual. Falta: 60 de lógica en la sala y el 1 % bajo cerca de 30 (pide CPU: el motor). Sin cambios en el `.wasm`.
- **2026-11-10 14:45** — **«⚡ Auto calibración: máxima fluidez»** (bitácora §274, el dueño: «un boton de auto calibracion de settings que pruebe de manera rapida y elija las settings que hagan que se vea mas fluido el juego (menor 1% lows) […] si está en un multiplayer debiera pausar […] a uno como a los otros con un aviso claro […] en maximo 30 segundos»). En Gráficos (y en la bienvenida y la Ayuda): prueba la Imagen (60 / 30 parejas / intermedia) y, si frena la tarjeta, la salida 720/540/360; 2 s cada una tras 0,5 s descartado; descarta lo que no da 57 de lógica; elige el mejor 1 % bajo; tope 30 s; guarda y «Deshacer». En los menús queda pendiente y arranca 5 s después del «¡YA!». En la sala la pausa es de todos: la anfitriona la da (una a la vez, una por persona en cada carrera, 30 s), todas las consolas **congelan la lógica después del mismo cuadro** (nuevo `congelar_nativo.cpp`: el juego no calcula y sigue dibujando la escena quieta; el lockstep no corta ni pausa a nadie y corre sus relojes al volver), los plazos de la sala quedan quietos, aviso «⏸ X está calibrando su imagen — vuelve en N s». Medido: este PC 10 s (se queda en «60 siempre»), gama baja 7,7 s (elige «30 parejas»: lógica 24,6 → 30,9/s; ninguna llega a 60), la sala de dos 12,2 s con las huellas iguales y nadie cortado. Banco `auto-calibrar` 51/51; `prueba-auto-calibrar` 11/11 y 12/12; `prueba-sala --rapida --calibrar` 52/52. **Cambió el wasm**: `build/web-274` → R2 (el dueño).
- **2026-11-10 09:25** — **Los bugs del multijugador de la v2.0, parte 2** (bitácora §269). El jugador que «queda acelerando y no reacciona»: la autoridad le inventaba «solo A» a quien llegaba más de 36 cuadros tarde; ahora va con sus botones de verdad atrasados (`tardeVivo`, retraso máximo 18; con el juego 1.816 → 0 inventados). Aviso de versión distinta en la sala, el informe de Diagnóstico con la sala, los mandos entre dos ventanas de un PC. Lakitu en la vuelta 3: 0 pedidos a la red en la sala de verdad (anfitriona e invitada, 2 carreras, red lenta). Celular: el mando en pantalla ya no queda pegado con la interfaz encima ni con la pestaña oculta (35/35), la caja negra de caídas, la memoria plana en el teléfono. La sala contra el Single Player (`medir-sala`, con su control): de 2 a 7 humanos igual (60/60) en este PC; en la gama baja la vigía de N8 apagaba N8 en la sala (miraba imágenes como lógica): 26,8 → 36,7 cuadros de lógica/s. Queda: el costo del motor por humano (~0,2 ms).
- **2026-11-10 08:45** — **En el teléfono solo vibra lo que importa, y suave** (bitácora §272, el dueño: «haz que en mobil solo vibre cuando choca con algo, le pega algo y al inicio con el ya o con el turbo con champiñón, pero vibre suave»). La página lee en la memoria del juego qué receta de vibración pidió (el número de `RequestRumble`, por la lista de vibraciones del ControllerHolder y las tablas de recetas) y manda un solo pulso corto: choque 35 ms (kart contra kart, objetos del circuito y la pared, que el juego no hace vibrar: flanco del bit de pared con el kart a más del 45 %), golpe 30 ms (plátano, caparazones, bombas, rayo, tinta, Thwomp…), la largada 22 ms y el champiñón 18 ms; lo demás (derrape, miniturbo, pasto, saltos, cajas, Bala, caídas) nada. El mando del PC sigue como §167; `?vibracionEventos=0` = el teléfono como antes. Sin cambios en el `.wasm` (nada nuevo a R2). Banco `vibracion` 57/57, `controles` 58/58; con el juego `bash herramientas/tanda-vibracion.sh nueva` 11/11 (Pixel 7 emulado: VS con 8 choques contra la pared y Contrarreloj con la largada y 3 champiñones). Falta ver un golpe de objeto con el juego (ninguna CPU le pegó en las pruebas; está en el banco).
- **2026-11-10 08:27** — **N8 en elegir personaje y «Imagen / Juego» en el medidor** (bitácora §270, el dueño: «no es posible ni aceptable que seleccionando personaje vaya a tan bajos fps tipo 25 si en el juego va a mejor fps, y que el limitador no funcione tampoco en los menús»; «diferenciarse por fps de video y fps de lógica»; el ritmo parejo de los menús). La causa: la CPU (556 dibujos por cuadro, 22–29 ms en la gama baja) y que N8 no existía en los menús. Ahora el tope del jugador vale en personaje/vehículo/derrape (`mkw_n8_menus`, la pila de pantallas; `?n8Menus=0`) y la vigía de Automático lo decide con los cuadros de lógica: en la gama baja la lógica de elegir personaje pasa de 48 a 60/s (sala, con «30 parejas»: de 34 a 60). El medidor: «Imagen N fps · Juego N/s», cada uno con su 1 % bajo (`crearRitmoJuego`). El compás de los menús (`ritmo-menus.mjs`) se probó y no se adopta (`?menusRitmo=1`). Falta: el 1 % bajo de las imágenes en la gama baja (pipelines que se compilan en esa pantalla). **Cambió el wasm**: `build/web-270` → R2 (el dueño).
- **2026-11-10 02:20** — **Ocultar la selección de pistas** (bitácora §271, el dueño: «agrega un boton en el multiplayer para ocultar y abrir la seleccion de mapas»). «▾ Ocultar» en la selección y la pastilla «🗺 Volver a elegir…» abajo; con la selección escondida, ⚙ y Controles quedan a mano. `?ocultarSelector=0` = como antes. Además el índice de imágenes se baja una vez y no dos (`imagenes.mjs`). `prueba-elegir` 72/72.
- **2026-11-10 01:10** — **El anfitrión en su ícono** (bitácora §268, el dueño: «tienes que indicar quien es el host tambien en el icono»). La cara del anfitrión lleva un anillo dorado y una coronita, en el vestíbulo y en la tira. El sitio va en la rama `mkw-anfitrion` (`2503ad17`, sin PR). Pruebas 53/53.
- **2026-11-10 00:25** — **El panel de récords de Mario Kart en Clasificación del sitio** (bitácora §267, el dueño: «que no sea overwhelming, tenga buscador, etc y sea organizado y limpio»; «agrega filtros en el buscador»; «Sí, termínalo»). «Ver: Récords de tiempo | Sala», la Tabla (Contrarreloj 150/200, Carrera con solo las cilindradas con tiempos), el podio por récords, la lista de pistas con tiempo (10 y «Ver más», cada fila un botón con su top 10 y el fantasma del 1.º), buscador por pista/copa/piloto y filtros Tú y Consola con pastillas; los nombres e íconos de las pistas del Worker con la caché (0 llamadas al volver). Dos rondas del crítico. Sitio: rama `mkw-records` (commit `9d499bd2`, subida, sin PR). Pruebas: sitio 51/51, `herramientas/prueba-panel-records.mjs` 28/28 (emuladores, escritorio y Pixel 7). Las reglas de Firebase no cambian.
- **2026-11-10 00:40** — **Sin «Servidor Oracle» en la sala** (bitácora §266, el dueño: «en el multiplayer quita eso de oracle»). En el vestíbulo del sitio, ✎ Cambiar → Conexión ofrece solo «Host: un jugador» y «Host + repetidor Cloudflare». Una sala que ya traía «oracle» queda en host. El sitio va en la rama `mkw-sin-oracle` (commit `b199e982`, subida, sin PR). Pruebas del sitio: `mkw`, `mkw-worker`, `salon` y `juegos`, 71/71.
- **2026-11-10 00:15** — **La Ayuda de ajustes primero** (bitácora §265, el dueño: «haz que siempre se abra este primero cuando se abren los ajustes»). La Ayuda pasó de Avanzado a su propia hoja, «❓ Ayuda», que es la primera pestaña del cajón. ⚙ de la barra y «Options» del menú de inicio abren siempre esa hoja. Los atajos con nombre (Partida, Controles, la pastilla del mando, las tarjetas de la ayuda) siguen yendo a su hoja. `?ayudaPrimero=0` = como antes. Pruebas: bancos `bienvenida` 58, `inicio` 16 y `controles-panel` 29; `prueba-bienvenida` todo ✓ y `prueba-inicio` 15/15 con el programa final.
- **2026-11-09 23:20** — **El multijugador abierto** (bitácora §264, el dueño: «abre las sesiones de multijugador»). En el menú de inicio, Multiplayer ya no está gris: `?multi=0` lo vuelve a cerrar. En el sitio, `SALAS_EN_OBRA` queda vacía, así que las salas de Mario Kart se crean y se puede entrar a ellas. Pruebas: banco `inicio` 16, `prueba-inicio` 15 con el programa final, sitio `mkw.test.cjs` + `mkw-worker` 37. Las 3 fallas de `controles`/`tienda` del sitio también fallan en `main`: no son de esto.
- **2026-11-09 21:20** — **El cierre del plan de rendimiento** (bitácora §261): el programa final para publicar es
  `build/web-final-w30/navegador` (W30 + todo lo adoptado sobre `web-e6-w29-clip`, `--final` con el PGO rehecho; `mkw.wasm.br`
  13,7 MB). La planilla, verde salvo `sala-doce` (el teléfono simulado: las mismas 4 de ayer, V7) y un punto del VR de `sala`;
  este PC +2,2 % (2 pares, zona gris; W30 ya medido en §257). **12 jugadores desde la página** (`prueba-doce-sitio.mjs`):
  entran los 12, el «¡YA!» en el mismo cuadro a los 98,5 s de «¡A correr!» (244 ms de diferencia por la carga), 56 cuadros/s
  con los 12 contra 59 de una sola, y una ventana frenada ×4 no baja a las demás. R2: 7.324 archivos, 5,00 GB (lo sube el dueño).
- **2026-11-09 21:55** — **La bienvenida, la Ayuda de ajustes, Controles estilo Big Picture y los mandos de Switch 2 y
  genéricos** (bitácora §263). Un mensaje que sale la primera vez y una vez por versión (`bienvenida.mjs`,
  `mkw.bienvenida.version`/`nunca`, `?bienvenida=0|1`; nunca en carrera ni con la cortina; en la sala solo en el descanso):
  una tarjeta por caso (va lento, celular, mando, sala) con su botón que lleva al ajuste y lo marca; lo mismo en Avanzado →
  «Ayuda de ajustes». Controles con el dibujo del mando y un globo por botón (`mando-dibujo.mjs`, «☰ Lista» = lo de antes);
  mandos sin orden: la disposición (`disposicion-mando.mjs`: el Pro y el GameCube de Switch 2 conocidos, «Enséñale tu mando»
  para los genéricos); el Switch 2 con cable se despierta por WebUSB (`switch2.mjs`; en Windows pide WinUSB con Zadig; sin
  probar con un mando de verdad: lo prueba el dueño al final). El selector «Imagen» con nombres cortos. Bancos `bienvenida` 58,
  `mando-dibujo` 59, `controles-panel` 29, `graficos` 66; `prueba-celular` 41; con el juego `prueba-bienvenida` 18/18 y la sala
  sin abrirse en carrera (`prueba-sincro --directa`, 14/14).
- **2026-11-09 20:30** — **Ocultar los avisos de lag** (bitácora §262, pedido del dueño: «agrega una opcion para ocultar los
  mensajes de lag»). Avanzado → Gráficos «Mostrar avisos de conexión y lag» (prendida por omisión, `mkw.avisosLag`, en el momento,
  `?avisosLag=0|1`; `web/navegador/avisos-lag.mjs`): apagada no se pintan los chips 📶 del relevo, «la sala va lenta», los 🔴 de
  conexión, «no llega a 60» ni «otra parte de la sala se separó»; quedan los graves (te cortaste, se espera a alguien, te
  echaron). La red, el registro y el informe (`avisosLag`) siguen igual. Banco `avisos-lag` 26; `graficos` 66, `conexiones` 24,
  `sala-carrera` 101; con el juego `prueba-sincro --directa --lento --extra-b=&avisosLag=0` 13/15: el punto §262 ✓ (B escondió 14 y pintó 0, A pintó 4, huellas iguales 57/57); los 2 ✗ (largada §250 298 ms, espera de A 2,04 ms) salen igual en el control sin la opción (12/14), no son de §262.
- **2026-11-09 19:40** — **La imagen intermedia de N8 pareja: adoptado** (bitácora §260). La causa no era el juego: la intermedia se pedía justo en el borde de un refresco y salía 3 y 5 refrescos alternados. `mkw.mjs`: la toma se anota cuando aurora pide la textura (`?tomaTic=0` = antes) y el compás no se queda en el borde (`?margenToma=0` = antes; `?diagN8=1` = el contador por tipo). Intermedia a 240 Hz: imágenes de 4 refrescos 50–64 → 92–97 %; a 60 el 1 % bajo 89 → 92 %; gama baja sin costo; sala n8=1/n8=2 15/15 (75/75), prueba-imagen 8/8.
- **2026-11-09 19:15** — **W31, guardar la traducción de las listas de dibujo y los render bundles: descartado por su techo**
  (bitácora §259). Una aurora propia (`terceros/aurora-w31`, `parches/aurora-w31.diff`) con el instrumento `?w31=contar|todas|quietos`:
  traducir las listas es 0,48 ms por imagen en este PC (4,7 %) y 1,48 en la gama baja (~7 %); reconocerlas con huellas cuesta
  0,39 / 1,17 ms; solo el 3,5 % son de objetos quietos (la cámara se mueve). El techo (ningún dibujo de las listas) da +4,4 %
  de promedio en la gama baja y ~+4 % en este PC, bajo el +8 %; los bundles ya medían −0,08 ms (§224). Las sombras cuadradas
  que vio el dueño eran el modo techo (foto con y sin: comprobado). `tanda-w31.sh`.
- **2026-11-09 17:33** — **W32, la IA de las CPU 1 de cada 2 (o 3) cuadros: descartado** (bitácora §258). Un programa aparte
  (`MKW_IA30_COMPILAR=1`, `web/juego/ia30_nativo.cpp`, `?ia30=2|3`): la IA pesa el 6,3 % de la lógica; la sala igual (15/15,
  huellas 75/75 con 2 y con 3); pero las CPU manejan mucho peor: recorren −17,4 % (ruido +0,8 ± 0,5), la ganadora +19 %,
  tropiezos 36 → 83 y caídas 8 → 23 por carrera, «Máximo» −17 % más fácil; la ganancia, de −2,5 a +11 % según la tanda, no se
  distingue del ruido. El dueño: «ok no apliquez esto entonces, se ve claro que sufre mucho la cpu». La tanda de 1 de cada 3 se
  paró. Instrumentos: `tanda-w32.sh`, `tanda-w32-tres.sh`, `comparar-ia30.mjs`, `peso-ia.mjs`, `video-ia30.mjs`.
- **2026-11-09 13:57** — **W30, «igual entre nosotros, no igual a la Wii»: adoptado** (bitácora §257). La FMA, el NI del FPSCR y el
  redondeo de C a 25 bits con las cuentas de wasm (`terceros/Wiicompiled-motor-w30`, `MKW_MOTOR_W30=7` por omisión, 0 = la Wii al
  último bit; `parches/motor-w30.diff`; las banderas CR no, §217). Chrome, tramo fijo: gama baja +7,1 / +3,4 %, este PC +5,9 / +7,7 %
  (zona gris; el dueño: «no necesitas correr mas, sigue nomas»); Node ×0,84; el `.wasm` −5 MB. La sala igual: prueba-sincro 15/0
  (huellas 74/74), prueba-sala 44/0. El fantasma del experto se separa en el cuadro 293 en 1 ulp, como mucho 1,2·10⁻⁵ vueltas antes
  de la meta y la cruza en el mismo cuadro (2242). `bash herramientas/tanda-w30.sh …`. Falta: juntarlo al programa final con PGO,
  `correr-todo` y publicar (el dueño).
- **2026-11-09 17:20** — **G16, el 1 % bajo de las imágenes que se ven** (bitácora §256, etapa 7). `imagenes-vista.mjs`: cada imagen de aurora (getCurrentTexture) con su tiempo de entrega a entrega (como PresentMon/Afterburner), el 1 % y el 0,1 % bajo, la causa de cada pico (pipeline, disco, sala, otro); lo imprimen `medir-sitio` (también lo que llegó al monitor), `medir-enlinea` (`--ventana`, refrescos por imagen, compás, despertar) y `tiempos-cuadro.mjs`; Gráficos «Gráfico del tiempo de cada imagen» = barras en vivo bajo el medidor (`?verGrafico=1`). La causa en la sala: el temporizador despertaba 0–7 ms tarde; arreglo: despertar 3 ms antes y ceder hasta el vencimiento (`?despertarAntes=0` = antes). A 60 a 240 Hz: imágenes de 3/5 refrescos 5,2 → 1,2 %, 1 % bajo 87 → 90 %; 30 parejas 92 → 94 %; la intermedia 75 % (sus dos imágenes salen en momentos distintos del cuadro: C++, propuesto); gama baja sin costo (CPU 53,5/53,9 ms) y limitada por la CPU. Sala 15/15 (74/74), prueba-imagen 8/8, bancos imagenes-vista 21 y graficos 66.
- **2026-11-09 12:20** — **G15, «Imagen» en plena carrera** (bitácora §255, etapa 7). Avanzado → Gráficos «Imagen»: Automático,
  30 parejas, 60 o con imagen intermedia, aplicado en el momento sin reiniciar (el juego cambia en el borde de un par de cuadros,
  `n8_nativo.cpp` `aplicarPedido`; `window.mkwImagen`). 21 cambios en una carrera: ninguna foto negra, 0 imágenes tiradas, lógica
  60,0; la sala con A en 30 parejas y B con intermedia, y con B cambiando cada 3 s: huellas iguales (75/75, 74/74).
- **2026-11-09 05:00** — **§250, la largada pareja** (el dueño: «unos largan antes que otros y todo termina desincronizado»). El «¡YA!» caía siempre en el mismo cuadro (412), pero a horas distintas: el árbitro y el relevo rápido dejaban correr la cuenta a la consola sana sin la trabada. Ahora, hasta el «¡YA!», nadie corre sin los botones de verdad de todos (`lockstep.mjs` `largadaPareja`, `?largadaPareja=0` = antes; el servidor de Oracle espera el aviso `{t:'ya'}`). El caso del dueño (B con 300 ms de lag y lenta): 738–988 ms → 49–84 ms; A trabada 6 s al cargar: 4,3 s → 47 ms; Oracle: 4,7 s → 56 ms; copa carrera 1/2: 41/11 ms. Bancos lockstep 60, relevo 65 (y 65 con `?arbitro=1`, antes 39/20), red 38, sala-carrera 101, arbitro-servidor 25; `bash herramientas/tanda-250.sh antes|despues`. Pendiente: con 600 ms ±200 y 20 % de pérdida y `&arbitro=0` la sala se parte tras el «¡YA!» (ya pasaba antes; con el árbitro, que es lo de omisión, no).
- **2026-11-09 04:54** — §251: la pantalla «Espacio» (⚙ Avanzado → Datos del juego) borra por partes: barra apilada (Pistas, Karts y sonidos comunes, Básico, Partidas 🔒), lista de pistas con casillas, ⭐, orden, «Deshacer» de 8 s y tope opcional 1/2/4 GB (apagado). `disco.mjs` borra por archivo (entradas, índice, memoria; canal entre pestañas; nunca la pista en uso). Banco `espacio` 73/73 (disco 56, paquete-carrera 53, controles-panel 25 siguen bien); con el juego `tanda-espacio.sh` 16/16.
- **2026-11-09 04:54** — **G13, sin partículas y «⚡ Liviano»** (bitácora §254, etapa 7). La casilla «Partículas» y el ajuste rápido «Liviano»
  (efectos apagados, texturas a la mitad, salida 540), todo como siempre por omisión. Sin partículas: −9 % de CPU por imagen en la
  gama baja; Liviano: −30 % de tarjeta; la carrera idéntica. **Con esto la etapa 7 queda terminada** (G11–G13 hechos; W10 B, W27,
  W28 y G14 descartados; W26 y V8 hechos). Lo del teléfono queda para el dueño, al final.
- **2026-11-09 04:46** — **G12, las texturas más chicas como opción** (bitácora §253, etapa 7). «Texturas» completas / la mitad / un cuarto
  (completas por omisión): aurora usa los niveles de detalle chicos que el juego ya trae. Un cuarto: −39 % de memoria de texturas
  (−128 MB en total tras 4 pistas); la velocidad no cambia en este PC; la carrera idéntica.
- **2026-11-09 04:03** — **G11, los efectos de la escena como opción** (bitácora §252, etapa 7). Brillo, desenfoque de lo lejano, sombras
  por volumen y mapa de luz se apagan por casilla (Avanzado → Gráficos; todo prendido por omisión). Apagados: la tarjeta −30 % en la
  gama baja, −40 % en este PC; la CPU igual; la carrera idéntica (sala, dos programas, fantasma, arranque).
- **2026-11-08 23:20** — **V8, el dibujo repartido** (bitácora §249, etapa 7). El lado CPU del dibujo (~9,7 ms por imagen en la
  gama baja) es 38 % código del juego y ~44 % aurora, runtime GX y WebGPU; ninguna pieza da los 3,3 ms de la meta. W27, W28 y G14
  descartados con esa razón. Siguen G11–G13 (opciones del jugador).
- **2026-11-08 23:10** — **W26, el conjunto acotado de pipelines** (bitácora §248, etapa 7). La memoria de la tarjeta crecía
  sin tope con cada pista (los sombreadores compilados). Ahora solo se guardan las últimas 4 pistas: la tarjeta tiene tope y una copa repetida
  no vuelve a preparar nada. Prendido por omisión en el teléfono; el PC sigue como antes. Huellas 75/75, fantasma igual. Sigue V8.
- **2026-11-08 22:30** — **La caída al volver a elegir en el descanso (M22) y el cuelgue de la copa, arreglados** (bitácora §248): no era la línea del motor sino G1 (§179.1): el gancho guardaba la dirección de la lista de `ClipInfo` de la carrera y `ScnMgr::DrawMain` seguía escribiéndole marcas en los menús, con esa memoria ya liberada y dada a los layouts de los botones. Encontrado con un punto de vigilancia (`build/web-vigia-caida`). Arreglo: `clipVigente()` en `lockstep_nativo.cpp` (la lista vale solo si `ClipInfoMgr::sInstance`, 0x809C2EF8, sigue siendo el que la armó). Con el final rehecho (`build/web-e6-w29-clip`): `prueba-sala` entera 46/0, la copa al azar (semilla 2658203969) 4/0 con 298 huellas iguales, G1 sigue recortando (`prueba-sincro --directa` 14/0). `bash herramientas/tanda-248.sh compilar sala copa g1`.
- **2026-11-08 20:40** — **W10 parte B, descartada** (bitácora §247, etapa 7). El par (A calcula sin dibujar y B dibuja)
  es más lento que el juego solo en todos los aparatos: gama baja −71 %, «Oppo» −41 %, este PC −60 % (tramo fijo, 2 pares).
  Marcar las escrituras y armar la caja cuesta más de lo que ahorra no dibujar. Sigue W26.
- **2026-11-07 17:40** — **Estado del plan combinado** (bitácora §238): A (E6) y B (R11) hechas; lo siguiente es la
  etapa E, **W10 parte B**, que arranca por el bucle propio del Worker B (§207.4 punto 1). Quedaba 4 % del uso semanal:
  se dejó la arrancada escrita en `docs/plan-combinado.md`, sin medir ni tocar código.
- **2026-11-08 01:10** — **W10 parte B, el dibujante con su propio bucle** (bitácora §240, etapa 7): B pega y dibuja 1.672 cuadros seguidos y su foto es la de A al píxel (0,000 % en los cuadros 900 y 1500); con A sin dibujar (el caso que gana) el par se traba en el cuadro 263: B queda en una espera del navegador que no se deja detener. Sigue: encontrar esa espera, después medir e igualdad.
- **2026-11-08 15:20** — **Los ítems a medias, cerrados** (bitácora §241–§245): R11 hecha (banco 21/21; host 13, Cloudflare 15, Oracle 14 y Oracle sin configurar 14, huellas iguales); N15 y P9 ya estaban cerrados (líneas viejas repetidas en `avance.mjs`, quitadas); E1 y E2 hechos en el PC (el Ahorro de energía de verdad de Chrome prendido por su preferencia: aviso 🔋, ahora prendido por omisión; un «calor» de mentira: aviso 🌡️, sigue opcional); W29 adoptada (512 MB alcanzan; el final con `--memoria-fija 768` por la ventana de H6: igualdad entera, gama baja +7,7 % en 6 pares; `build/web-e6-w29`); N2 medida con el final y el teléfono del dueño simulado (le falta para 60: portátil ×1,20, gama media ×1,76, gama baja ×2,49; frena la CPU). Lo del teléfono real queda para el dueño.
- **2026-11-07 02:23** — **E6 pausada por el dueño** (§237.11–§237.13). La copa terminó en 16 min en ambas páginas,
  sin caídas y con cuatro salidas del teléfono de la carrera compartida. Host de doce con árbitros reales 27/39:
  PC a 59,3–60,0 y teléfono a 10,4–13,8 cuadros/s. Las esperas de carrera exceden 50 ms. Contraste N8 detenido antes
  de un par válido. Candado liberado. Memoria plana, limpiezas y planilla verde siguen abiertos.
- **2026-11-07 01:34** — **E6 retomada por el dueño** (§237.9). El banco Chrome de sincronía da 60/60,
  incluido el caso de la consola atrasada que pierde el historial. El contraste N8 necesita `dibujarSiempre=1`
  en ambos modos: sin ese ajuste RR omitió dibujos y N8 contó cero saltados. Siguen las tres carreras Host con
  tres PC y la tanda con teléfono simulado, además de la copa con el arreglo. Sin commit ni publicación.
- **2026-11-07 00:56** — **E6 pausada por el dueño** (§237.8). Host con tres juegos: 59,6–59,7 cuadros/s
  con red mala simulada, huellas iguales, 0 ms de espera del anfitrión durante las trabas y hasta 728 ms
  acumulados en una traba del tercero. Host con doce plazas: 59,8 y 59,7 en los PC y 10,8 en el teléfono
  durante el minuto medido. La tanda se detuvo antes de verificar la primera meta. Candado y turno liberados.
  Quedan pendientes el control de tres PC en Chrome independientes, la copa corregida, la escalera N8,
  memoria plana, la meta de limpiezas y `correr-todo` en verde. Sin commit ni publicación.
- **2026-11-06 18:59** — **E6 retomada por pedido del dueño**: fantasmas E6 contra E4c final 6/6,
  2.118 cuadros iguales y llegada en el cuadro 2242. Cinco bancos específicos verdes (incluido consola-falsa
  7/7 con el PC libre). N12 avisa en ambas páginas antes de largar con el juego real. La igualdad de sala
  sigue 74/74, pero su espera promedio B de 5,12 ms supera el límite de 4 ms: pendiente, sin ocultarla.
  Corre `herramientas/continuar-e6.sh` con candado: N12, V7, copa telefónica, hora, GC, escalera y planilla.
  Se corrigió la prueba de memoria para rechazar muestras ausentes y sesiones menores de una hora.
  Detalle en bitácora §237. Sin commit ni publicación.
- **2026-11-05 12:25** — **E6 (la página liviana y la prueba final): a medias, parado por el dueño** (bitácora
  §232–§235). **P5**, el código hecho: los búferes del sonido reciclados (`sonido-reciclar.mjs`: el worklet los devuelve
  con su informe cada 32 bloques) y una sola llamada a la página por entrega (`parches/motor-p5.diff`); bancos
  `sonido-worklet` 39/39 y `sonido` 14/14; `build/web-e6` (final con PGO): `prueba-arranque` 13/13 y la sala contra
  e4c-final con huellas 74 = 74; falta medir la basura (`tanda-e6.sh gc`) y los fantasmas iguales. **N12** hecho:
  `escalon.mjs` (el escalón en el informe de rendimiento, la última carrera en `mkw.capacidad`, la capacidad en el latido
  de la sala y el aviso antes de largar; `?escalon=0`, `?comoLento=L`); banco `escalon` 24/24, `sala-carrera` 101/101;
  falta probarlo con el juego. **V6** (`herramientas/medir-sesion-larga.mjs`) y **V7** (`banco/consola-falsa`,
  `prueba-sala-doce.mjs`, `esperasLargas` en el lockstep): las herramientas hechas, sin correr; el banco `consola-falsa`
  dio 5/7 con el PC ocupado (repetirlo). Falta: la escalera, `correr-todo`, CLAUDE.md, `avance.mjs` y el plan regenerado
  (la lista en §232.2). Candado suelto; sin commit (lo hace la orquestadora).
- **2026-11-07 00:25** — **Las tres conexiones de la sala listas en local** (§236). Host por omisión, host con
  repetidor Cloudflare y servidor Oracle con vuelta al host. Banco Oracle **21/21**. Juego con `prueba-sincro
  --directa` bajo el candado: host **13/13**, Cloudflare **15/15**, Oracle **14/14** y Oracle sin configuración
  **14/14**. Sitio **23/23**, `juegos-app.js` rearmado y parche fuente en `parches/paginita-mkw-conexion.diff`.
  El dueño configura su VM y el archivo privado cuando quiera habilitar Oracle. Guía en `docs/publicar-oracle.md`.
- **2026-11-05 08:40** — **R4 (el lockstep sin basura por cuadro): hecho** (bitácora §230). `lockstep.mjs` con
  anillos fijos con etiqueta (`Anillo`, `AnilloReg`), el paquete de botones en un búfer reusado y votos con contadores
  (`malla.mjs` `degradar` y el banco `relevo` copian lo que demoran). Igual byte a byte en 6 escenarios con reloj
  virtual (`node --expose-gc herramientas/r4-igual.mjs <viejo> --gc`): el lockstep limpia 2–7 veces menos. Con el
  juego (`bash herramientas/tanda-r4.sh gc relevo telefono`): en Chrome la basura de la carrera no cambia (23–25
  chicas y 1–2 grandes en 40 s con los dos: la hace el resto de la página); huellas iguales; con el árbitro A espera
  0 ms en las 8 trabas (C, con la red mala, igual que antes de R4); un Chrome normal y otro como teléfono de gama media,
  3 carreras con la huella ampliada igual. Queda propuesto al dueño si el árbitro va por omisión. Bancos `lockstep` 59,
  `relevo` 59, `red` 38. Sin commit (lo hace la orquestadora).
- **2026-11-05 08:20** — **N11 (el teléfono débil ve la carrera en video desde un PC): piloto con puerta, matado**
  (bitácora §229–§229.1). Instrumento: `web/navegador/n11-video.mjs` (`?n11=MBIT`: la imagen del juego por WebRTC a un
  receptor en la misma página; `&n11Marca=1` = la hora pintada en una tira de 24 cuadritos, la demora de punta a punta),
  `&vistas=2` en `?modo=directa` (la pantalla partida), `medir-sitio --dpr N` (el lienzo de verdad a 720), la tanda
  `herramientas/tanda-n11.sh prueba video vista`. Medido a 720: H.264 a 8 Mbit/s da 56–60 img/s con QP 27–29 (pasa
  raspando; con menos no da 720); el video agrega **56 ms de mediana y 87 de p90 sin red** (la vara era 50: falla) y la
  gama media simulada no llega a 60 ni sin la vista de más (12–14 img/s a 720; con el video, 5–8 img/s). No se construye
  la opción. Nada publicado; sin commit (lo hace la orquestadora).
- **2026-11-05 06:10** — **PGO adoptado (W25, bitácora §228.2; decisión de la orquestadora)**: `compilar-web.py --final`
  rehace o reusa el perfil solo (`herramientas/pgo_final.py`: el programa que cuenta en `<carpeta>-pgo-gen`, las 3
  carreras de `herramientas/pgo/` con la partida base, `profraw-v11.mjs`, `llvm-profdata`; el perfil fuera de git, en
  `%TEMP%/mkw-pgo/`; `--sin-pgo` = sin él). El final con PGO (`build/web-e4c-final`): arranque 13/13, huellas 75/75 contra
  el final sin PGO, fantasmas 2.113 iguales, `.wasm` 112,4 → 102,4 MB (`.br` 13,9 MB). **Subirlo a R2 lo hace el dueño.**
- **2026-11-05 05:25** — **W25 / E4c (las mejoras chicas, juntas): el paquete no gana; PGO queda en el borde** (bitácora
  §228). El paquete (`MKW_CHICAS=c2,c3,c4,c7`: texturas BC1, funciones calientes, memo ×4, `wasm-opt -O3`; C5/C6 del
  traductor no se hicieron) contra una base de las mismas fuentes: igualdad entera bien (arranque 13/13, huellas 75/75,
  fantasmas 2.113/2.113, foto 0,000 %, BC1 51 dB); 6 pares: gama baja −0,3 % (−9,4 a +8,9), este PC −0,3 %: **no se
  adopta**. PGO sobre la base (§228.1): la misma igualdad bien, `.wasm` −8,9 %, gama baja +7,5 % de media (mediana
  +10,2 %, 5 de 6) pero el intervalo baja a −0,2 %, este PC +1,1 %: **no pasa la regla por 0,2 puntos; lo decide la
  orquestadora**. La foto igual necesita `&enganche=0` (`?fotoCuadro` solo frena sin el enganche); `profraw-v11.mjs`
  deja afuera la ficha cortada. `bash herramientas/tanda-e4c.sh compilar igual foto medir pgo igual-pgo medir-pgo`.
- **2026-11-05 02:15** — **W24 (el teléfono solo dibuja): piloto con puerta, matado** (bitácora §227; el dueño: «solo si
  es que sirve»). La puerta se anotó antes de medir (subida ≤ ~3 Mbit/s por teléfono, el dibujo solo +20 % o 60 en la gama
  baja, demora extra ≤ ~50 ms). Medido en la carrera de 12 CPU en 4 pistas con el programa de W10 (`?w10=7`): la caja pesa
  104–134 KB por cuadro (51–66 Mbit/s); achicada (resta XOR + código de ceros + deflate, `w24-caja.mjs`, idéntica de
  vuelta) baja a 40–54 KB = **20–27 Mbit/s**: falta ×7–9, y deflate cuesta 1,6–2,8 ms por cuadro en el PC. Las puertas 2
  (+30–85 %, estimada) y 3 (media ida y vuelta + ~33 ms) no salvan la 1. **No se construye la opción**: nada en Gráficos
  ni en la página; queda el instrumento (`w24-caja.mjs`, banco `w24-caja` 7/7) y la parte B escrita sin compilar en
  `parches/w24-parte-b.diff` + `parches/motor-w24.diff` (para W10 §207.4). `bash herramientas/tanda-w24.sh caja`.
- **2026-11-05 00:50** — **Etapa E4b: W21 día 1 hecho, W22 y W23 descartados con su medida, W24 no se hizo (opcional, del dueño)** (bitácora §224–§226). **W22**: el censo de las llamadas a WebGPU (`censo-gpu.mjs`, `?censoGpu=1`; `medir-sitio` lo imprime): ~1.400–1.570 llamadas y 26 pasadas por imagen; volver a codificar la imagen entera cuesta 0,17–0,19 ms de 10,7 (≤ 3 % con el paso wasm→JS; ≤ 0,6 ms en la gama baja, bajo la puerta de 2 ms); como render bundles ~0,10 ms; solo la mitad de las órdenes se repite igual: el esqueleto del cuadro está del lado de wasm, no en las llamadas. **W23**: la prueba chica (`micro-indirectas/generar-callref.py` + `correr-callref.mjs`): en Chrome 156 `call_ref` pierde +20 a +52 % contra `call_indirect` (Chrome ya mete en línea `call_indirect` de un destino: 0,61 ns); no se toca el traductor. **W21**: `sw-aislar.js` + `?aislar=sw|sw-corp` (apagado por omisión) aíslan el marco del juego en el sitio local: `prueba-aislar-sw.mjs` 8/8 con las dos formas (memoria compartida, Juegos sin cambios, token y Worker de R2, la carrera, el sonido); aislado solo no gana (−4,5 % este PC, −3,4 % gama baja, un par, dentro del ruido); seguir pide el PR del dueño (pasar a mensajes `mkwConectar*`) y un programa con hilos. `prueba-navegador` 22/22. Tanda: `bash herramientas/tanda-e4b.sh censo|callref|aislar|aislar-medir`. Nada publicado; sin commit (lo hace la orquestadora).
- **2026-11-04 11:35** — **N8 en «Automático» por omisión** (bitácora §223, decisión del dueño: «permito que se prenda N8 en automatico»): `GRAFICOS.n8 = 'auto'`; la vigía decide (en un PC que llega a 60 no se prende; donde frena la tarjeta se apaga sola); el «No» a mano se mantiene; con Playwright sin N8 salvo `?n8=…` y `&n8=0` en las 5 herramientas que abren Chrome solas. Banco `graficos` 50/50 y `n8` 22/22, arranque 13/13, sala con las dos en Automático 14/14 (huellas 75 = 75; con B frenada, prendida y apagada sola, huellas 77 = 77).
- **2026-11-04 08:30** — **Etapa 4: los techos del dibujo por grupo; W15/W16 bajan de prioridad frente a W10, W17 y W18 descartados con su medida** (bitácora §222): el instrumento de W3 ampliado (`techo_dibujo_nativo.cpp`: `?techo=1|2|4` pista, efectos, modelos por opción de dibujo con `?techoOp=`; `tanda-e4.sh`, `build/web-e4t`) esconde cada grupo solo mientras se dibuja; tramo fijo con `&dibujarSiempre=1`, gama baja con límites, 2 vueltas intercaladas: karts +0,6/+1,6 %, objetos −2,6/−3,2 %, pista −1,8/−2,4 %, efectos +3,0/−0,5 %, todo junto (178 modelos, la pista y los efectos) +3,7/+2,2 % (este PC −2,4/+3,2 %): ningún grupo pasa el 5 %. Lo caro del dibujo (~10 ms de ~20, por N8) es el esqueleto del cuadro, no los modelos (−0,7 ms). W17 estimado ≈ +4 % (física y colisión ≈ 17 % del cuadro, ×1,3 en una versión propia): no pasa con margen. Para E5: medir el esqueleto del cuadro (2D, copias, posproceso, aurora). Nada publicado.
- **2026-11-04 05:50** — **Etapa 3 cerrada: N8 hecho, opcional y apagado por omisión** (bitácora §219, el resumen en §221): en la carrera el juego dibuja uno de cada dos cuadros (`web/juego/n8_nativo.cpp`) y aurora muestra la imagen del medio con la real guardada (`parches/aurora-n8.diff`); `?n8=1|2|auto` y Gráficos «Dibujar a 30 y mostrar 60» (No por omisión; decisión del dueño 2026-11-02: solo para el aparato que no llega a 60 o si el jugador lo pide). Igual: fantasmas 2.117/2.117, sala huellas 74 = 74, arranque 13/13. Tramo fijo, gama baja con límites: +34/+47 % (`?n8=1`) y +41/+30 % (`?n8=2`) de lógica/s, decidido con 2 pares; a tiempo real ayuda al que no llega por la CPU (lastre 3: lógica 43–53 → 54) y no al que frena la tarjeta (la vigía lo prueba 10 s y lo apaga). Demora +16,3 ms con `?n8=2`. Bancos `n8` 22, `graficos` 50; `herramientas/tanda-n8.sh`.
- **2026-11-04 03:06** — **W10 junto con E2** (bitácora §220): rama `e2-w10` en `terceros/Wiicompiled-motor-h6` (`f7181fe`, `parches/motor-e2-w10.diff`; W10 apagado por omisión; arreglado el atajo de `psq_st` de H6 que se saltaba la marca). `build/web-e2w10` (`--final`): arranque 13/13, sala 75/75 y fantasmas 2.116/2.116 contra `build/web-e2`; el instrumento con `?w10=4`: 0 páginas sin marca; la foto del mismo cuadro con la marca contra sin ella: 12/12, 0 % distinto. Es el programa base de E3 y E4. Nada publicado.
- **2026-11-04 10:30** — **Etapa 2 cerrada** (bitácora §218, el resumen): hechos H6 (gama baja ~+29 %) y M7 (+8,6 %); descartados con su medida H7, M6, H11, W12, W13 y W14. `compilar-web.py --final` lleva por omisión `--fija` (si la copia la trae) y el ThinLTO de M7; el programa final `build/web-e2` da la misma carrera que M7 (huellas 75/75, fantasmas 2.114/2.114, arranque 13/13). Escrito cómo juntar e2-h6 con W10 (`memory_access.h` a mano). Nada publicado.
- **2026-11-03 14:30** — **Etapa 2, W14 descartado con su medida** (bitácora §217): el techo de §193 medido bien en Chrome (los dos dibujando cada cuadro): gama baja +11,6 / +17,7 %, este PC −9,2 / −11,3 %. El modo seguro, terminado (destinos de las indirectas, operaciones del CR exactas, phi y saltos indirectos, `herramientas/w14/banderas.py`, `parches/traductor-w14.diff`), sigue en U = 0xFF: ~180 posibles destinos leen el CR entero de verdad. No pasa la regla de E2 ni en su techo. `tanda-h6.sh`: `H6_FIJA=0`, `H6_EXTRA`, el detector pide solo el programa de cada fase.
- **2026-11-03 10:50** — **Etapa 2, W13 descartado por su techo** (bitácora §216): cada uno de los 4,3 millones de accesos al contexto de la CPU hecho dos veces (`herramientas/w13/`): gama baja −10,8 / +4,3 %, este PC −2,6 / −10,4 %. W13 solo abarataría esos accesos (sin la revisión de límites), no los saca: no vale 1–2 semanas con el riesgo de las interrupciones y las fibras. `tanda-h6.sh` termina con salida 0.
- **2026-11-02 22:20** — **Etapa 2, W12 descartado por su techo; pausa del dueño** (bitácora §215): cada acceso a la pila de la Wii hecho dos veces (238.412, `herramientas/w12/`) no se distingue del ruido en Chrome (gama baja 0 / −11,7 / +3,5 %, este PC −4,7 / +1,4 / +1,4 %; Node ×1,011): sacarlos no gana. `tanda-h6.sh` con detector (un compilar fallido para la tanda al instante; sin programa no se prueba ni se mide). Pausado por el dueño a mitad del 4.º par; falta W13, W14 y el cierre de E2.
- **2026-11-02 19:50** — **Etapa 2, H11 descartado con su medida** (bitácora §214): las 30.426 de 33.057 funciones traducidas que no corren en 3 carreras perfiladas, compiladas con `minsize` y `cold` (`h11-caliente.mjs` → `frio.h`, `compilar-web.py --frio`, `tanda-h11.sh`): `.wasm` −5 %, la misma carrera (huellas 74/74, fantasmas iguales, arranque 13/13), pero Chrome gama baja con límites −1,4 % de mediana en 4 pares (la regla de los 2 pares pidió 2 más) y este PC +0,3 %. Queda la bandera, fuera del programa de E2.
- **2026-11-02 18:30** — **Etapa 2, M6 descartado y M7 hecho** (bitácora §213): M6 se decide con W4 (§198) sin repetirla (gama baja +2,2 %, perfil atado a cada cambio del motor). M7 = ThinLTO del runtime, aurora y lo propio de la página (`MKW_LTO` en `compilar-web.py`): gama baja con límites +8,6 % de mediana en 7 pares, este PC −1,4 %; huellas 75/75, fantasmas iguales. VUELTA32 en Chrome pierde 7–11 % en la gama baja (§212.1). Regla del dueño: los veredictos con Chrome, sin el nativo, y sin sumar vueltas a lo que no sirve.
- **2026-11-02 14:50** — **Etapa 2, H7 descartado con su medida** (bitácora §212): el techo (`MKW_H7_TECHO`, dar vuelta tres veces) dice que una vuelta de bytes vale ~8–10 % del cuadro (Node ×1,165, ×1,202 con límites, por dos vueltas de más); restando lo que H7 agrega quedan ~×1,04–1,06 contra 3–5 semanas que tocan dibujo, sonido, NAND y página. VUELTA32 (la vuelta de 4 bytes con SIMD) tampoco gana: ×0,986, ×1,064 con límites. Instrumento en la rama `e2-h6` (`parches/motor-h7-techo.diff`, apagado).
- **2026-11-02 13:50** — **Etapa 2, H6 hecho** (bitácora §211): la RAM de la Wii en una ventana fija de la memoria de wasm, sin la tabla de páginas (`MKW_MOTOR_FIJA`, rama `e2-h6` en `terceros/Wiicompiled-motor-h6`, `parches/motor-h6.diff`, `compilar-web.py --fija`, `tanda-h6.sh`): gama baja con límites **~+29 %** (20,3 contra 14,8–16,7 cuadros de lógica/s), este PC +2 a +7 %, Node ×0,838 (×0,881 con límites); huellas 75/75, fantasmas 2.115/2.115, paridad 28/0, arranque 13/13; `.wasm` −3 %; la memoria física igual (`medir-memoria.mjs` ahora la imprime). Los ítems siguientes de E2 miden contra `build/web-h6b`.
- **2026-11-02 07:30** — **Etapa 1 cerrada** (bitácora §210, el resumen): W11 hecho, H5 hecho, N3 cerrado (la puerta A no pasa: −4,3 % en la gama baja), P10 no hace falta, W10 con el techo y el costo medidos (×2,10 gama baja, ×3,46 este PC) y la parte B como prototipo (falta que el Worker del dibujo tenga su propio bucle). Todo apagado; nada publicado.
- **2026-11-02 07:30** — **Etapa 1, W10: techo y costo hechos, parte B prototipo** (bitácora §207): la marca de páginas sucias (`parches/motor-w10.diff`, `-DMKW_SUCIAS`) y la caja de diferencias (`web/juego/w10_nativo.cpp`, programa aparte `MKW_W10_COMPILAR=1`): 83–125 KB y ~0,2 ms por cuadro, 0 páginas sin marca; sin el dibujo la carrera rinde ×2,10 en la gama baja y ×3,46 en este PC con `?dibujarSiempre=1` (nuevo, apagado: la compensación de lag de RR escondía el dibujo en la gama baja); huellas 75/75 en 0.0 y 13.2, el fantasma 2.119/2.119. Parte B (`w10-dos.html`, `prueba-w10-dos.mjs`): arreglados las pilas de los hilos y el planificador (banco `w10` 19/19); se cuelga a los 14 cuadros por las esperas entre hilos de las dos copias: falta un bucle propio de dibujo en B.
- **2026-11-02 07:30** — **Etapa 1, W11 hecho** (bitácora §209): efectos, qué suena y el hilo de sonido no los lee la carrera (huellas 75/75 y fantasmas iguales con cada uno saltado, `?w11=máscara`); juntos +28 % gama baja, +7 % este PC; van a B con W10.
- **2026-11-02 07:30** — **Etapa 1, N3/P10/H5** (bitácora §208): la puerta A con 5 pares en la gama baja: Worker 45,30 contra página 47,33 cuadros de lógica/s (−4,3 %): **no pasa**, la carrera se queda en la página; P10 no hace falta; H5 hecho (el informe dice `hilos`, banco `aislamiento` 16/16, teléfono simulado 8/8, `docs/publicar.md` §8 sin publicar).
- **2026-11-01 22:15** — **Etapa 0, W3 matado** (bitácora §200): el techo de dibujar la pista en nativo = esconderla del todo (`ModelDirector::ToggleVisible` antes de cada dibujo; RR carga la pista por `rr_overlay_8078E1B0`). Ni así baja: este PC +0,8 % (mediana de 3 pares), gama baja +4,3 %, con el perfil de la tarjeta 13,27 → 13,63 ms de CPU por imagen, Node ×0,998. Lo caro del dibujo no es la pista: no empezar W15 por ella; medir antes el techo de karts, objetos y efectos. `herramientas/tanda-w3.sh`, `web/juego/techo_dibujo_nativo.cpp` (`MKW_TECHO_COMPILAR=1`, `?techo=1`).
- **2026-11-01 23:37** — **Etapa 0, W9 hecho** (bitácora §205): el aviso de las tarjetas Adreno 6xx/7xx (`web/navegador/adreno.mjs`, «[tarjeta]» en el registro y `adreno` en el informe; banco `adreno` 11) y el camino de reserva apagado de aurora (`?huesosFilas=1`: las matrices de los huesos leídas por filas, como lo esquivó KartPad). La foto del mismo cuadro: `prueba-foto-igual.mjs` ahora usa la Contrarreloj contra el experto (la carrera de 12 CPU no se repite: las CPU eligen personaje con el reloj) y compara desde el 32 % del alto (arriba, los rayos del sol y el cronómetro cambian solos): control y reserva **0,000 %** en los cuadros 600 y 1500, sin errores WGSL; `prueba-navegador` 21/0. Se prende para las Adreno con el primer informe de un jugador.
- **2026-11-02 00:30** — **Etapa 0, W8 hecho (queda apagado)** (bitácora §203): 8 pistas en la misma pestaña (`medir-memoria-pistas.mjs`, ahora con las texturas de aurora y el costo por pista): el proceso de la tarjeta crece +1,07 a +1,14 GB y **son los sombreadores** que aurora guarda sin soltar (`sShaderModuleCache`); soltar solo los pipelines de las otras pistas (`?soltarPipelines=1`, 413 soltados; arreglado el atajo config → pipeline con la época `g_mkwPipelinesEpoca`, que dejaba la 3.ª pista en negro) no cambia nada (+1.132 MB). `?soltarPipelines=2` también vacía la memoria de sombreadores: **−132 a −168 MB**, intercalado con el mismo programa sin soltar (+1.067/+1.125), los mismos armados en el momento y +37 % de dibujos saltados al cargar cada pista nueva. `prueba-navegador` 22/0 y 21/0. Se prende con W10 en el teléfono y la sala tras medir en qué etapa caen esos saltos. `tanda-w8.sh`, `tanda-w8b.sh`, `tanda-w8d.sh`; `parches/aurora-e0.diff`.
- **2026-11-02 00:30** — **Etapa 0 terminada** (bitácora §206, el resumen con las recomendaciones para E1 y E4): hechos W5, W19, W6, W1, N2, W9, W8 (apagado); matados W2 y W3; no se adoptan W4 (zona gris) ni W20; W7 no hace falta. E1: W10 sigue (la foto por diferencias, 1,5–2 MB por cuadro; los menús en el hilo del juego; el modo 2 de W8 junto con W10). E4: W17 no entra como estaba (W2 murió: una isla tiene que ser una implementación propia), W15 no empieza por la pista (medir antes el techo de karts, objetos y efectos). Abierto, de antes de la etapa 0: `prueba-sala --rapida` falla en M22 (la carrera 2 no usa el personaje que A volvió a elegir) con todos los programas de la línea del motor desde `build/web-m1`; con `build/web/navegador` pasa 44/0 (§203). Nada subido ni publicado.
- **2026-11-01 21:25** — **Etapa 0, W4 en la zona gris, no se adopta** (bitácora §198): PGO con el perfil del wasm mismo (3 carreras con guiones, pistas que el tramo no usa; `herramientas/profraw-v11.mjs` arregla la cabecera que escribe el runtime de emscripten). La misma carrera (sala 14/0, fantasmas 6/0), el `.wasm` −8,3 % (118,0 → 108,3 MB). En 6 vueltas intercaladas: gama baja +2,2 % (mediana de los pares), este PC +3,2 %, Node ×0,998. Entre el corte (2 %) y el éxito (5 %): no paga rehacer el perfil con cada cambio del motor; M6 no entra completo en la etapa 2. `herramientas/tanda-w4.sh`.
- **2026-11-01 20:45** — **Etapa 0, W1 hecho** (bitácora §196): el dibujo es un sumidero en la carrera: con B deshaciendo todo lo que escribe el dibujo (salvo `SwitchScnRoot`, 1,4–2,7 KB por cuadro), las huellas coinciden en 6 pistas (2 de Nintendo, 4 de RR; 40–44 de 40–44) y el fantasma sale igual cuadro por cuadro en 2 Contrarrelojes. La carrera cambia 1,5–2,0 MB por cuadro (máximo 35–42 MB al cargar): W10 sigue, con la foto por diferencias. En los menús el dibujo NO es un sumidero (deshacerlo traba la Contrarreloj). `herramientas/tanda-w1.sh`, `web/juego/sumidero_nativo.cpp` (`MKW_SUMIDERO_COMPILAR=1`, `?sumidero=1|2`).
- **2026-11-01 19:30** — **Etapa 0, N2 hecho** (bitácora §201): la escalera con la base de la etapa 0 (`build/web-w19`) y los teléfonos con la revisión de límites (W5), 2 corridas: este PC 152,7 cuadros de lógica/s, PC típico 93,3 (+17 % desde §164), portátil 43,8 (+20 %; le falta ×1,37), gama media 30,6 (le falta ×1,96), gama baja 18,7 (le falta ×3,21). En todos frena la CPU (tarjeta 0,2–2,1 ms por imagen). `herramientas/tanda-n2.sh`.
- **2026-11-01 19:10** — **Etapa 0, W20 no rinde** (bitácora §204): soltar las texturas de copia ociosas (KartPad `0cca4d2`, solo la piscina, con atribución; `parches/aurora-e0.diff`, `?piscina=1`) funciona (28 soltadas) pero la piscina pesa ~6 MB: la tarjeta crece igual (+1.128 MB en 8 pistas contra +1.073). Queda apagado; lo que crece es W8. `herramientas/tanda-w7.sh w20`, `herramientas/medir-memoria-pistas.mjs` (nuevo).
- **2026-11-01 19:00** — **Etapa 0, W7 no hace falta** (bitácora §202): 0 avisos «sub-copy unsupported» en 5 pistas enteras (0.0, 5.3, 13.2, 30.2 y 65.0), con el camino del aviso hasta la consola comprobado; el arreglo de KartPad `998c456` no se trae. `medir-carrera-entera.mjs` cuenta el aviso (`subcopias`).
- **2026-11-01 17:15** — **Etapa 0, W2 matado** (bitácora §199): la isla de la colisión (`KCLController::IsCollidingImpl`) es correcta (400.000 llamadas comparadas, 0 distintas; sala 15/0; fantasmas 6/0 y 6/0) pero no gana: ×0,95 por llamada y ×1,002 en el cuadro (corte ×1,4). Una isla armada transformando la traducción ahorra en las lecturas lo que pierde en el borde; para la etapa 4, islas propias que cubran mucho tiempo y con el techo medido antes. `herramientas/tanda-w2.sh`, `herramientas/islas/generar-kcl.py`, `web/juego/isla_kcl_nativo.cpp` (`MKW_ISLA_COMPILAR=1`, `?isla=N`).
- **2026-11-01 16:40** — **Etapa 0, W6 hecho** (bitácora §197): en la carrera, el programa de Windows con los bytes dados vuelta como wasm (`compilar-nativo.py --bytes-lentos`, nuevo) tarda +23,5 % y con la tabla de páginas (`--revisado`) +43,1 % (1,666 → 2,058 / 2,383 ms por cuadro, 5 vueltas ±1,7 %). Juntas el 67 % del nativo y cerca de la mitad del impuesto del wasm (×2,29): **H6 y H7 van primero en la etapa 2**; la parte cara de H7 no se corta. `herramientas/tanda-w6.sh`, `parches/motor-w6.diff`.
- **2026-11-01 15:55** — **Etapa 0, W19 hecho** (bitácora §195): el memo de las llamadas indirectas toma los bits altos del hash (KartPad `20ad85d`, con atribución; `parches/motor-w19.diff`, commit local `da2c7b8` en `terceros/Wiicompiled-motor`). Huellas 75/75, fantasmas 6/0, paridad 28/0. Gama baja simulada 17,82 → 18,57 cuadros de lógica/s (+4,2 %, con ruido de ±5 %), este PC +0,5 %, Node ×0,989 (ruido). `build/web-w19` es la base de la etapa 0. `herramientas/tanda-w19.sh`.
- **2026-11-01 14:50** — **Etapa 0, W5 hecho** (bitácora §194): la simulación del teléfono ahora paga la revisión de límites de Android (`--js-flags=--wasm-enforce-bounds-checks`). En el tramo fijo: gama baja simulada 21,7 → 16,8 cuadros de lógica/s (−23 %), gama media 32,3 → 30,1 (−6,8 %), este PC 151,8 → 142,7 (−6,0 %), Node 3,81 → 4,61 ms/cuadro (+21 %). Toda medición del teléfono simulado va con la bandera desde ahora. `herramientas/tanda-w5.sh`.
- **2026-10-31 23:10** — El dueño: «descarta todo lo que no rinda y no sea necesario para nuestro objetivo»; 18 ítems descartados, quedan 35 pendientes. Del plan de rendimiento salen H3, H4, N4, G9, P9 (los hilos con memoria compartida y la CPU con la tarjeta en paralelo: W10 los contiene o la tarjeta no frena), N15b (la aurora nueva), M9, W18, M11 (los cubre otro ítem), P1, P2, D10, D11 (con el juego en un Worker o sin pedidos en la carrera no tocan el cuadro) y U4, E1, E2, D7, D14 (no son rendimiento); N15 queda hecho (N15a). Lo ya escrito de E1/E2 (`?ahorro=1`, `?calor=1`) y P9 (`?aislar=dip`, banco `aislamiento`) sigue apagado en el código. Etapa 1: 6–9 semanas; etapa 4: 12–22; etapa 6: 1–2; el total, 24–42 semanas (antes 28–50). Cada porqué en `herramientas/plan-rendimiento/avance.mjs` y en el paso 17 de `docs/plan-rendimiento.md`. Nada medido, publicado ni guardado en git.
- **2026-10-31 22:30** — **El plan de rendimiento, versión 4** (el dueño: «rehace el plan entonces»; los resultados de la v3, «bien tristes»; el techo de lo que quedaba, ×1,5; pidió soluciones más grandes y revisar KartPad). Siete etapas en `herramientas/plan-rendimiento/` → `docs/plan-rendimiento.md`: **E0** pilotos con umbral de éxito y de corte (2 semanas: W1 M0 = páginas sucias y el sumidero, W2 la isla KCL ×2,0/×1,4, W3 un modelo dibujado nativo −0,5 ms/2 %, W4 PGO, W5 la simulación del teléfono con `--wasm-enforce-bounds-checks`, W6 bswap y el nativo «revisado» en la carrera, N2; y los arreglos de KartPad W7 XF parciales, W8 los pipelines en una copa, W9 Adreno); **E1** el dibujo en otro núcleo (W10 A1-s, W11 A2, con los pasos 8–9 viejos); **E2** el motor (H6/H7, PGO M6/M7/H11, W12 la pila, W13 el contexto, W14 el CR perezoso); **E3** N8 en el Worker B; **E4** las islas decompiladas, solo si pasan los pilotos (W15 D-a, W16 D-b, W17 colisión y física, W18 efectos); **E5** las salas (N11, R4); **E6** la página y la prueba final. Descartados (15): M3, M4, M5, M8, M10, H8, H9, H10, N5, N6, N7, N9, G7, G10, H13. Metas estimadas: PC típico y portátil 60 dibujados; gama media 60 dibujados al borde; gama baja 60 de carrera con 30 dibujados e imagen intermedia, y N11 en la sala. 58 de 129 ítems hechos. Nada medido ni publicado.
- **2026-10-31 21:45** — El dueño: el Oppo ya no se mide; el plan verifica todo con el aparato de mentira (H1) y el tramo fijo (§163).
- **2026-10-31 21:40** — **§190 (paso 15, cortado por el dueño: G6 terminado, N8 sin hacer): E1/E2 hechos y apagados, G6 hecho y apagado, G4 medido y descartado.** E1/E2 (`energia.mjs`, `?ahorro=1`, `?calor=1`): avisan en la esquina el ahorro de energía de Chrome (refrescos de ~33 ms con el juego liviano) y el calor del teléfono (ms por cuadro +25 % y +1,5 ms dos minutos seguidos); banco `energia` 19/19, con el juego 7/7 (`prueba-energia.mjs`); falta el aparato de verdad (`docs/medir-oppo.md` §F). G6 (aurora `cmpr_to_bc1`, `?texturasBc=1|verifica`): CMPR → BC1 sin volver a comprimir; 66 de 89 texturas, 15,2 → 1,9 MB en la tarjeta, 51 dB textura por textura, la foto difiere menos que dos fotos de siempre (banco `texturas-bc` 10/10, `prueba-texturas-bc.mjs` 7/7); tramo fijo: este PC igual, gama baja tarjeta −4,5 % dentro del ruido, y el teléfono no tiene BC → queda opcional. G4: el ubershader no conviene (~0,1 % de los dibujos, solo 1.ª visita, semanas de trabajo); la parte barata medida con lo que aurora ahora cuenta (de la cola / de la lista / nuevo): con `pipelines-c2` la carrera pide 3 (este PC) y 1 (gama baja), antes de C2 18–57; las 64 del Oppo eran de fondo con la semilla vieja: las saca publicar `pipelines-c2.bin`. `parches/aurora-web.diff` rehecho; `herramientas/tanda-190.sh`.
- **2026-10-31 21:50** — **§193.1 (M8 banderas «seguro», a medias, detenido por el dueño).** El seguro de §193 tenía un error mío (sin plan caía en la máscara del techo): su medida no vale; arreglado. El análisis nuevo resuelve el programa entero (juego + mod, con el volcado del mod entre dos traducciones): da **U = 0xFF** (alguna función lee el CR entero al entrar) y con «cualquier función puede ser destino de una indirecta» casi nada se enmascara. Falta saber qué funciones pueden ser destino de una indirecta (las que tienen su dirección guardada); la segunda traducción se cayó al escribir el resultado (arreglado, sin correr). Copia `terceros/Wiicompiled-motor-seguro` `3796636`, `parches/traductor-m8-banderas.diff`.
- **2026-10-31 20:20** — **§193 M8, las otras pasadas (paso 6): ninguna se adopta todavía.** Hojas en línea al doble (27.919 lugares): Node ×0,9995, Chrome este PC −0,5 %, gama baja −6,0 % (el código crece; sala 75/75) → no. La memo de indirectas 512 → 2048: Node ×0,993 (ruido) → no. Banderas: el «techo» (confiar en la regla de la Wii, solo cr1–cr4) da Node ×0,8825 pero **la sala se separa en el cuadro 270** → inválido, solo marca el máximo; el modo «seguro» (vivacidad de todo el programa, 92.726 guardados con máscara) da ×0,9928 porque los retornos nunca se enmascaran: el analizador supone que cada llamada indirecta lee todo el CR. Causa encontrada, arreglo descrito en §193 (la unión de lo que leen las funciones al entrar; el mod iterado entre pasadas); pendiente por el tope de uso semanal. Parches `parches/traductor-m8-hojas.diff`, `traductor-m8-banderas.diff`, `motor-m8-memo.diff`.
- **2026-10-31 18:55** — **§192 R2 (paso 11): saltarse el dibujo de un cuadro sin cambiar la carrera** (apagado por omisión). En un cuadro saltado, la envoltura de `ScnMgr::DrawMain` corre solo `SwitchScnRoot` (adentro está `ModelDirector::Update`, lo que la lógica lee) y la escena 3D no llega a la tarjeta; el pedido se engancha al principio de cada vuelta de `RKSystem::Run`. `_mkw_dibujo_saltar/patron/modo/este_saltado`, `_mkw_dibujos_saltados[_juego]`, `?saltarDibujo=N`, `?saltarDibujoModo=1`. La sala con B saltando 1 de 2 y 2 de 3: las mismas huellas (75/75); la Contrarreloj con el fantasma igual byte por byte. El tiempo ganado se mide con N8 (paso 7), cuando aurora deje de presentar esos cuadros.
- **2026-10-31 16:55** — **§191 R1 (paso 11): el árbitro como opción, `?arbitro=1`.** La autoridad escribe los botones de todos; cada uno espera solo a ella y manda lo suyo a ella, al suplente y a quien decide su corte. Con el juego: A esperó 0 ms en 8 trabas de 1,5 s (antes mediana 310), la PC lenta ya no frena a la sala, con 6 jugadores 120 paquetes/s en vez de 300; la misma carrera. Precio: los que no son autoridad, 3–5 cuadros más de retraso. Banco `relevo` 59 (caso 22), `lockstep` 59. Queda apagado: lo decide la sesión con el Oppo.

- **2026-10-31 16:45** — **§184 (la FMA «punto medio», paso 6): medida en el juego, no se adopta.** Exacta (la sala con un programa en cada consola: 75/75 huellas iguales), pero más lenta: Node ×1,018 (6 pares, repetidos porque la 1.ª vuelta chocó con una compilación mía), Chrome este PC −2,8 % y gama baja −7,5 % de cuadros de lógica/s. Copiada en línea en miles de lugares, lleva los dos caminos y el código crece; el 3× del banco era una función suelta. No cuenta para H8. De paso: las tandas llevan el nombre de su variante en el candado (dos se creían dueñas) y esperan hasta 6 h; la fase de Chrome de `tanda-m1.sh` mide con `&anillo=0`; `prueba-fantasma-igual.mjs` falla también A contra A (una palabra de la ficha cambia de corrida a corrida): ahora imprime el desplazamiento y acepta `--ignorar`.

- **2026-10-31 16:40** — **§181.2 (N14 cerrado, paso 7): medido, no hay dónde reescribir función por función.** El comprobador bit a bit (`web/juego/caliente_nativo.cpp`, `MKW_CALIENTE=2`) da 0 diferencias en las tres funciones de matrices (8 M llamadas sobre M1), pero en el cuadro no ganan: traducida 3,871, nueva 3,887 (×1,010), nueva con las ps_madds SIMD 3,835 ms (×0,991), todo dentro del ruido (Node `--fijo`, 6 vueltas intercaladas): no se adopta ninguna. El perfil de M1 (paso 6) explica por qué: el impuesto está repartido parejo en 1.886 funciones (las 50 primeras = 34 % del cuadro); solo PSMTXConcat se aparta (2,5× la media), y es la FMA emulada. La ganancia de N14 es la **FMA «punto medio»** del runtime (banco `fma` 9/9: 0 diferencias en 70 M casos, 3× más rápida con operaciones sueltas), que adopta y mide el paso 6 (`MKW_MOTOR_FMAF_PUNTO`). 8059A278 (1,5× la media) revisada: nada raro (guarda f30/f31 con psq_st). La reverb ×36 era un error de la medida (el sonido corre en otro hilo en el nativo). G3/H12 quedaron también en la aurora de la v0.9.3 y prendidos por omisión tras la verificación.

- **2026-10-31 14:30** — **§181.1 (G3 y H12 hechos, paso 7): no volver a subir lo que no cambió.** Tres anillos detrás de los búferes de aurora (vértices +8 MB, índices +4 MB, storage +16 MB): vértices e índices por huella xxh3 al cerrar el lote (con `vtx_start` corregido), los arreglos de la pista por lugar y generación de escrituras del juego. Tramo fijo §163, 2+2 intercalados: la subida por imagen 1,2–1,4 MB → 0,4–0,5 MB (quedan los uniformes, que cambian con la cámara), la tarjeta de la gama baja 3,14 → 2,83 ms por imagen (−10 %), CPU igual dentro del ruido. Prendido por omisión (`?anillo=0` = como antes, `?anillo=verifica` = la huella completa de cada acierto); `parches/aurora-web.diff` rehecho; banco `anillo` 15/15; `herramientas/tanda-181.sh`. Verificado con `?anillo=verifica`: 0 diferencias (~2 GB reusados en una carrera); también en la aurora de la v0.9.3 (`terceros/aurora-main-viejo-motor` `2a99260`+`5aa3fca`). N14 en curso: el perfil dice que el impuesto está repartido; lo que gana es la FMA «punto medio» del runtime (3× en el banco `fma`, 0 diferencias en 70 M casos), que adopta y mide el paso 6.

- **2026-10-31 13:55** — **§179.1 (G1, paso 11) y §180 (la fila del candado, el banco relevo con reloj virtual)**: G1: el dibujo recorta con las marcas de verdad de mi cámara y la lógica sigue con «todo a la vista» (`lockstep_nativo.cpp`: el gancho de ClipInfoMgr guarda las marcas; ScnMgr::DrawMain las pone de verdad mientras dibuja y las borra al terminar; `?recorteDibujo=0` = como antes, `=modelos` = solo las opciones de los modelos); la misma carrera en las 11 salas con el recorte (huellas 74–75); −0,7 ms por cuadro en este PC (A 9,8 → 9,1, B 8,7 → 7,9), igual al techo (`?arreglos=0`): hoy «todo a la vista» cuesta ~0,7–1 ms aquí, no los 4–5 de §85. §180.1: el banco `relevo` con reloj propio (`?relojVirtual=0` = el de verdad), la red con semilla y 2 ms de trabajo por cuadro: 7 s en vez de 6 min, 54/54 tres veces seguidas (y con las semillas 5 y 9); los casos 1 y 17 ya no dependen de la carga. §180.2: los botones que la autoridad pone por mí mientras me releva no suben mi retraso (`?calmaRelevado=0` = como antes; caso 1: 12 → 6).

- **2026-10-31 13:45** — **§182 (M1 y M2 hechos, paso 6)**: la memoria de la Wii más barata en wasm (los rangos y los psq resueltos con la tabla de páginas, el camino rápido de Read/Write en línea y la vuelta de 8 bytes con SIMD; `runtime/include/mkw_motor.h`, cada uno apagable con `-DMKW_MOTOR_<NOMBRE>=0`). Paridad 28/0, 13/13, la sala con M1 contra la v0.9.3 13/13 con 74 huellas iguales. Node ×0,930 (6 de 6 pares), Chrome este PC +1,6 % (ruido), **gama baja +5,2 %** (3 de 3 vueltas). Adoptado en `terceros/Wiicompiled-motor` (8165125); `herramientas/tanda-m1.sh`. Sigue el perfil por funciones con M1 para elegir las pasadas de M8.
- **2026-10-31 12:25** — **§170.2 (N15a cerrado, paso 6)**: la razón wasm/nativo con una partida limpia propia en cada corrida (`partida-aislada.mjs`, `guion-170`): base vieja ×2,45, v0.9.3 ×2,48, el nativo 1,70 ms en las dos (la v0.9.3 en wasm ×1,018, dentro del ruido). G2 de N13 también en la aurora de la v0.9.3 (`terceros/aurora-main-viejo-motor` 518ed3d). `tanda-170`/`tanda-m8`/`tanda-m1` con la fila del candado (§180, `candado_hueco` entre fases). Queda N15b (la aurora nueva, con G9/H4).
- **2026-10-31 11:40** — **§179 (R7, paso 11) y correcciones de §177.3/§177.6**: la autoridad suma al puntaje el margen por cuadro, la subida que estima WebRTC y si es un teléfono (viajan en el informe tipo 10; `?autoridadCapaz=0` = como antes); un teléfono le pasa el papel a un PC en cuanto sabe que hay uno, y la sala pone al teléfono detrás de los PC para la carrera siguiente (`ratosMalos` +10000). Banco `relevo` caso 21 4/4 (y 4/4 con `?autoridadCapaz=0` en la dirección: Ana se queda con el papel); `prueba-sincro --directa --extra-a=&comoTelefono=1` 14/14 (A le pasa la autoridad a B, huellas 75/75). R6: los casos con otra ventana de la 10:35 no valían (`--vista-b` no se aplicaba: el patrón sin barras); repetidos 1260×540, 400×800 y 1260×540 + escala ×2 + fluidez 120: 13/13, huellas 74/74. R9 repetido: 15/15. Las tres marcas nuevas con su punto en el banco por la dirección (`relevo?solo=20&trabaViva=0`, `relevo?solo=21&autoridadCapaz=0`, `controles?ocultaCero=0`).

- **2026-10-31 11:10** — **§178 (M8, primera pasada, paso 6): no releer r14–r31 después de cada llamada — no gana nada.** La vigía (`MKW_M8=vigia`, 92.670 comprobaciones) halló las 8 funciones que rompen la regla en el camino a la carrera, todas de Retro Rewind (4 ganchos y 4 continuaciones); el modo `seguro` (solo llamadas directas desde código del juego, nada hacia o desde mod, hilos del sistema fuera) saca el 47 % de esas lecturas (496.003 → 262.761), 0 avisos de la vigía, 13/13, y mide **×1,00** contra v0.9.3 (6 pares intercalados en Node; `ind` ×0,99). No se adopta (queda en `parches/traductor-m8.diff`, `herramientas/tanda-m8.sh`); siguen H6/H7, M1/M2, M6, H11, M7. Parado al 82 % del uso semanal.
- **2026-10-31 10:35** — **§177.3–§177.6 (pasos 1–3 y 11: R6, R3, R9)**: R6 en este PC, B con otra ventana (1260×540, 400×800), `fluidez=180`, escala ×2 o `aspecto=libre`: la misma carrera (huellas 74–75 de 74–75, 13/13 cada una; `prueba-sincro --vista-b= --extra-b=`), falta el Oppo (medir-oppo parte D). R3 (la traba viva): el ping lleva el cuadro y «espero a alguien»; al que contesta pero no avanza se lo pausa a los 150 ms (`?trabaViva=0`): Ana esperó 985 → 181 ms (banco `relevo` caso 20, 3/3; entero 48/49, el 17 es la carga: solo 6/6 con y sin), `lockstep` 59/59. R9 (la pestaña oculta): al segundo, el mando en reposo (`?ocultaCero=0`): banco `controles` 53/53, `prueba-sincro --oculta-b=12` 15/15 (A 56 cuadros/s, la misma carrera). Pasos 1–3: paso1.2 hecho, E4 descartado (solo PC + Oppo), V1/H1/H2/U3/N2 esperan el Oppo (`docs/medir-oppo.md` A–D).
- **2026-10-31 10:03** — **§177.2 (G2, paso 10)**: aurora descarta la profundidad de una pasada si la siguiente que la usa la limpia (`?descartarZ=0` = guardar siempre; `parches/aurora-web.diff`). En Mario Kart no ocurre nunca: las copias que limpian (4.171 en un minuto) cubren 893×456 de la imagen interna de 939×528 y se limpian con un dibujo recortado; en este PC y en la gama baja simulada la tarjeta igual (0,2 / 1,0 ms por imagen), `prueba-navegador` 21/21. Lo que ahorraría en el teléfono (limpiar el recuadro como imagen entera) pasa a N9 con el perfil por pasada del Oppo.
- **2026-10-31 09:16** — **§177.1 (G5, paso 10)**: en este PC, con `force_16_9`, la vista del juego es 16:9 en cualquier forma de ventana (2,18:1 y parada, con barras; `herramientas/medir-aspecto.mjs`, fotos); el 2,18:1 del Oppo era el lienzo, no la vista. El informe de rendimiento dice ahora la vista (`vista`); falta confirmarlo en el Oppo.
- **2026-10-31 09:10** — **§177 (paso 4 sin el Oppo, medición)**: en 40 s de carrera, este PC 0 tareas largas y 0 pedidos al Worker (60 fps); con la CPU ×4 también 0 pedidos, pero cada cuadro del juego (68 ms) es una tarea larga: eso es el motor (pasos 6 y 8, N3), no la carga. El criterio 1 (la traba de ~300 ms al largar la 1.ª carrera en 2 núcleos, TurboFan) queda para H11/N3. Sin cambios de código.
- **2026-10-31 08:50** — **§176 (D1 hecho y el relevo 46/46)**: con la carrera andando no sale nada a la red: 0 pedidos en este PC y en la gama baja (la 13.2, perfil nuevo y segunda vuelta con lo aprendido; el juego no esperó a la red nunca). El paquete trae la música de la pista (`?musicaPaquete=0`), lo común (`?comunCarrera=0`), las dos voces de cada personaje (`?vocesAmbas=0`) y lo aprendido por pista (`?aprender=0`); la sala pide la carrera en curso y la siguiente (`?pistaSala=0`) y la ficha. La medida: `mkwRedEnCarrera` (lo que de verdad sale a la red, con la etapa de la carrera); `mkwFaltas` contaba también lo que venía de la caché del navegador. `medir-carrera-entera --mismo-perfil`. El candado común `herramientas/candado.sh` (la espera de 20 min no se repite). Banco `paquete-carrera` 53/53, `disco` 56/56, `relevo` 46/46 (el caso 17 con su sala de control), `lockstep` 59/59.
- **2026-10-31 06:03** — **§175: las 6 pruebas de la planilla en verde** (partidas 6/6, menus 8/8, invitados 13/13, tactil 14/14, precarga 8/8, doce 11/11). La partida que el servidor da a un perfil nuevo es una copia limpia (`partida-base.mjs`, `build/web/partida-base`: Node y Windows ensuciaban la de `terceros/`); el índice de los grupos de la caché se guarda en el momento (`disco.guardarIndice`) y una lectura de grupo se comparte; `pipelines.mjs` lee el formato 2; la sala ya no corta a quien todavía carga (`seFue` exige haberla oído) y, si se parte, sigue la isla más grande (`?islas=0` = la autoridad). Banco `lockstep` 59/59, `disco` 55/55, `pipelines` 19/19, `prueba-partida-base` 10/10.
- **2026-10-31 05:45** — **§174 (D8 y C2 hechos)**: medidos por los menús hasta la 13.2 (tanda 174b, A antes / B D8 / C D8+C2). C2: pipelines armados de golpe antes de largar 15 → 3 en la gama baja y 6 → 3 en este PC; la carga con la CPU ×4 suma 8 % menos de tareas largas (21,7 → 19,9 s). D8: largada 53,7 → 52,5 s en este PC; en la gama baja dentro del ruido de una corrida (157 → 154 s): ahí manda la red (≈150 MB antes de largar). En la carrera nadie esperó a la red en ninguna. La v0.9.3 compila con los dos.
- **2026-10-31 02:25** — **§174 (D5 hecho): una versión por archivo**: el manifiesto trae `[ruta, tamaño, huella]` (`subir-r2.mjs`: SHA-256; el Worker publicado no cambia), la caché del disco guarda cada pedazo con la huella de su archivo en la caja `mkw-disco:por-archivo` y barre lo huérfano 20 s después de abrir si cambió la versión (`?versionArchivo=0` = una versión como antes). Medido (`medir-version-archivo.mjs`, precarga, un archivo «cambiado»): la 2.ª visita baja 50,2 MB en vez de 62,8 (40 bloques de la caché en vez de 0; sin cambio 25,3); barrido 89 entradas en 129 ms. Banco `disco` 49/49, `prueba-subir-r2` 25/25.
- **2026-10-30 20:31** — **§169 (D4 hecho, U2 en curso): el paquete de carrera** (`web/navegador/paquete-carrera.mjs`, `?paqueteCarrera=0`): con la ficha de Racedata pide la pista, los 12 karts según la skin de RR, GRP_RACE/GRP_PRESENT, las voces (de la skin si la trae, si no del brsar) y el principio de las fanfarrias; acierta 9 de 10 piezas. En un jugador casi no cambia (largada 12,3 → 12 s; gama baja 104,8 → 104,6 s; quita la única espera de la carrera en la gama baja), porque la ficha llega con la carga: donde tiene tiempo para ganar es la sala (D1). Banco `paquete-carrera` 28/28 (`t173-sin|con`). **§171 (C5 hecho): la caché en grupos de 2 MB** (`disco.mjs` `cajaGrande`, `?cajaGrande=0`): con la CPU ×4, la 2.ª visita pasa de 22,8 a 17,2 s en tareas largas (−25 %), en este PC igual; banco `disco` 43/43 (`t173-caja*`). **§172 en la sala**: armados de golpe al empezar la carrera 114/106 → 84/77 (`prueba-sincro --directa` 13/13 las dos).
- **2026-10-31 01:00** — **§169 (U2 hecho): la pista apenas se elige en los menús** (`paquete-carrera.mjs` `leerPistaElegida`/`armarPista`/`revisarPista`, `enMenus`: solo con la sección de los menús en curso y la pista quieta 1 s; `?pistaTemprana=0` = solo con la ficha). Por los menús (`medir-carrera-entera.mjs --menu vs|gp`, `tu2d-*`): VS 13.2 pedida 3,7 s antes de que el juego la abra en este PC y 15,7 s en la gama baja; 0.0 (la de omisión) y el GP, por la ficha, sin arranques falsos; en el GP las otras 3 de la copa con prioridad baja; en carrera y meta nadie esperó a la red. D4 queda prendido: no gasta memoria (63,8–64 MB igual) ni baja de más (gama baja +1 MB de 109) y ahorra pedidos (366 → 284). Banco `paquete-carrera` 39/39.
- **2026-10-30 19:30** — **§173: los datos del Oppo del 30-10, leídos**: la tarjeta trabaja ≈ 3 ms por cuadro (las pasadas se pisan en la tarjeta de mosaicos; lo que frena es la CPU), 64 pipelines compilados en plena carrera (el s. 98: pip57 sh56), 2–3,7 MB subidos a la tarjeta por cuadro (H12/G3) y la carga con el disco esperando 0,6–1,3 s cada segundo (D1/D9). El informe ahora trae `perfilTarjeta.tramoMs` (último fin − primer comienzo, mediana; `mosaicos`, `aviso`) y, con «Mostrar qué frena», `ultimos10s.cpuPuraMs` (`?cpuPura=0` = como antes). Banco `perfil-gpu` 17/17; `docs/medir-oppo.md` al día; notas en H13, H12, G3, D1 y D9 del plan (campo `nota` nuevo de `generar.mjs`).
- **2026-10-30 19:28** — **§172 (C3): ningún pipeline armado de golpe**: aurora anota los que tuvo que armar de golpe y los exporta primero (`g_webUrgentes`, `parches/aurora-web.diff`; también va a la v0.9.3); la semilla con 3 carreras enteras (`medir-carrera-entera --pipelines` + `herramientas/juntar-pipelines.mjs`: 795, 163 urgentes, `build/web/navegador/pipelines-c3.bin`, la sube el dueño; `?pipelines=<nombre>.bin`). De golpe antes de largar 28/101/125 → 10/10/42 por pista y 93 → 19 en la gama baja; en la carrera 0 antes y después (`t172-*`).
- **2026-10-30 18:40** — **§168 (D9): la semilla de bloques con el camino de verdad**: 3 carreras enteras de hoy + los menús de la vieja (294 bloques, `bloques-d9.json`, la sube el dueño; `?bloques=<nombre>.json`): esperas a la red antes de largar 17–19 → 6–9, lecturas con la carrera armada 14–15 → 4–6; de la cuenta a la meta 0 esperas (`t168-*`).
- **2026-10-30 17:15** — **§167: la vibración del teléfono, hecha pulsos parejos** (el dueño: «vibra de manera descontrolada»): el juego prende y apaga el motor muy seguido (PWM) y la página lo mandaba tal cual (`navigator.vibrate(5000)`/`0`, hasta 60 por segundo, y 5 s a fondo si un apagado se perdía); ahora `vibracion.mjs` manda una orden cada 100 ms con el ciclo de trabajo (pulso en el teléfono, fuerza en el mando), tope de 2 s seguidos, para al ocultar la pestaña. `?vibracion=vieja` = antes. Banco `vibracion` 18/18, `controles` 49/49. Falta que el dueño lo sienta en el Oppo.
- **2026-10-27 21:34** — **§128 (E3): lo táctil sin costo por movimiento**: la inclinación se escucha solo con «dirigir inclinando» prendido, y los recuadros de los botones se miden al empezar cada toque y se reusan. `?tactilLiviano=0` = como antes. Banco `controles` 48/48. `prueba-tactil` 10/14 y `controles-panel` 24/25 **fallaban igual sin este cambio** (probado apagándolo): la prueba táctil es de antes de las piezas escondidas de §113 y el «+» de la zona muerta con el cursor no sube; `prueba-celular` no arranca (falta el navegador propio de Playwright).
- **2026-10-27 21:52** — **§129 (P8, terminado): la cortina y los récords sin mirar el juego cuando no hace falta**: la vigía de la cortina no lee nada con una carrera andando, y `vigilarCarreras` no lee en los menús (sigue leyendo la carrera terminada hasta salir, para no perder el tiempo final). `?relojesLivianos=0` = como antes. Banco `records` 22/22; `prueba-sala --rapida` 43/43 (una corrida antes, 39/43 por una elección de personaje intermitente).
- **2026-10-27 21:53** — **§130 (C6): armar los archivos del juego** en 35 ms en vez de 59 (mediana de 3, esta PC; 6.065 archivos, 10,4 MB): cada carpeta se crea una sola vez. `?armadoRapido=0` = como antes; `mkwEstado.armado`; `node herramientas/medir-armado.mjs`. Queda debajo de los 50 ms de una tarea larga en el PC; en el teléfono habría que medir.
- **2026-10-27 21:55** — **§131 (P6): el filtro de la sala, una vez por paso** (antes una por puerto: 4 lecturas de los menús por refresco). `?menusUnaVez=0` = como antes. Banco `controles` 49/49; `prueba-sala --rapida` 43/43.
- **2026-10-27 21:56** — **§132 (C4, en parte): los lotes del disco con prioridad** «high» si el juego espera, «low» si son de fondo. `?prioridad=0` = sin. Banco `lote` 22/22, `disco` 42/42, `prueba-navegador` 22/22. Falta la cubeta de fichas (el freno) y medirlo con red lenta: C4 queda en curso.
- **2026-10-27 22:14** — **§133 (U1, en parte): esperar los gráficos de los menús antes de jugar, en el teléfono**: al elegir Single Player o Local, si no llegó la primera mitad de los pipelines, la cortina «Preparando los gráficos… N %» (tope 30 s). Solo en el teléfono; `?esperaGraficos=1` = también en el PC, `=0` = nunca. En el PC costaba 4–6 s sin ganar nada (`node herramientas/medir-espera-graficos.mjs`: del Enter a «Un jugador» 8,6/10,0 s contra 4,4/3,5 s; a los 20 s ~693 de 700 llegados igual). En el teléfono, sin medir. Pausar el precalentado en la carrera = recompilar: U1 en curso. Banco `preparacion` 25/25; `prueba-inicio` 8/14 con y sin (las fallas son de §116: hay que ponerla al día).
- **2026-10-27 22:17** — **§134 (C10, terminado): jugando solo, la pestaña oculta pausa el juego**: la espera del reloj no termina hasta que la pestaña vuelve a verse (sin sala, sin red). `?pausaOculta=0` = sigue corriendo dormido (§120). `medir-oculta.mjs`: oculta, CPU 80 % (antes de §120) → 63 % (§120) → **0 %**, 0 cuadros; al volver sin ráfaga (29 cuadros el 1.er segundo, después 57/s). `prueba-navegador` 22/22. No necesitó recompilar.
- **2026-10-27 22:24** — **§135 (R8): lo grande por el canal fiable, en trozos de 1 KB** (`malla.mjs` `trocear`/`crearArmador`; quien recibe arma siempre). `?trozos=0` = enteros. Banco `red` 38/38: un paquete `udp` detrás de 200 KB por `tcp` llega en 1 ms en vez de 9 (dos corridas); sin trozos, 4 MB ni salen (el tope de Chrome por mensaje). `prueba-sincro --directa` 13/13.
- **2026-10-27 22:25** — **§136 (P4, en parte): dos bucles de cada refresco que trabajaban para nada**: el contador DNF mira cada 10 refrescos sin cuenta (`?dnfLiviano=0`) y el menú de inicio escondido deja de girar (`?inicioLiviano=0`). Bancos `inicio` 16/16 y `cuenta-dnf` 25/25; con el juego, `prueba-inicio` y `prueba-sala --rapida` (`prueba-sala --rapida` 43/43; `prueba-inicio` 8/14, las mismas 6 fallas de antes, de §116). Falta el planificador único: P4 en curso.
- **2026-10-27 22:25** — **§137 (E6, en parte): el medidor avisa cuando el monitor no es múltiplo de 60 Hz** (`notaHz`: 75/144/165 Hz no se ven del todo parejos). Banco `graficos` 45/45. Falta P4 y probar con 144 Hz: E6 en curso.
- **2026-10-27 22:27** — **§138 (C9, en parte): la memoria de bloques del disco según la RAM** (`memoriaDeBloques`: 64 MB con 8 GB o sin dato, 32 con 4–6, 16 con menos; `?memoriaBloques=N`). En esta PC no cambia. Banco `disco` 43/43. Falta medir la memoria por proceso: C9 en curso.
- **2026-10-27 22:30** — **§139 (C4, en parte): la cubeta de fichas de lo de fondo** (`lote.mjs` `freno`: la mitad del ancho medido, lotes de fondo de 4 MB, lo urgente nunca espera). **Apagada por omisión** hasta medirla (`?freno=1`). Banco `lote` 24/24. Medido con `medir-sitio --perfil pc --red 20` (1.ª visita, una corrida por lado): **sin freno** la carrera llega a los 122,8 s, la carga tiene 49 cuadros de más de 100 ms (el peor 3,4 s), 6 lecturas urgentes; en la carrera 10 tirones (el peor 1.070 ms: 888 ms esperando el disco), 58,1 fps. **Con freno**: la carrera a los **161,5 s** (+39 s), 79 cuadros de más de 100 ms (el peor 8,2 s), **38** lecturas urgentes (el juego esperó lo que el fondo no había bajado); en la carrera 1 tirón (29 ms), 60,0 fps. Queda **apagado**: la carga empeora mucho más de lo que mejora la carrera; lo que falta es frenar solo mientras hay sala/carrera (o bajar antes, D1), no en la carga.
- **2026-10-27 23:22** — **§140 (U1, hecho): el precalentado en pausa durante la carrera** (aurora `mkw_web_pipelines_pausa`, recompilado; `mkw.mjs` la llama con la vigía de la carrera; `?pausaPrecalentado=0`). Medido (`medir-sitio --perfil celular-alto`, 1.ª visita): la cola se vacía a los 14–16 s y la carrera llega a los ~105 s, así que la pausa es un seguro (fps 34,0 → 34,5, ruido). Con §133 (la espera de la mitad en el teléfono) U1 queda hecho.
- **2026-10-27 23:22** — **§141 (C9, hecho): la memoria por proceso medida y 230 MB menos por pestaña** (`herramientas/medir-memoria.mjs`; `compilar-web.py --memoria-inicial 320` en vez de 512, `_sbrk` exportado; los archivos chicos se sueltan tras armar MEMFS, `?soltarChicos=0`). La pestaña 1.186 → 938 MB (heap 512 reservado/248 usado → 320/248), 2 juegos 3.936 → 3.458 MB. La tarjeta ~650 MB por juego queda para G/H. Pruebas con el programa nuevo: navegador 22/22, sincro --directa 13/13, partidas 6/6, sala --rapida 43/43.
- **2026-10-27 23:22** — **§142 (C4, hecho): el freno de fondo solo en la sala ya cargada** (`lote.mjs` `frenoActivo`; `mkw.mjs`: `modo=sala` y `preparacion.lista()`; `?freno=0` nunca, `?freno=1` siempre). En la carga baja a toda velocidad (la carga de §139 sin freno). Banco `lote` 25/25, `prueba-sala --rapida` 43/43. Sin medir: el latido de una sala con red lenta.
- **2026-10-27 23:22** — **§143 (P4, hecho): un solo bucle de cada refresco** (`relojMonitor.alRefresco`: el cajón y los mandos colgados de él; anillo de 240 periodos, mediana cada 30; `?planificador=0`). `prueba-navegador` 3+3 corridas: parejas 91,9/90,4/92,1 % con, 90,4/90,4/91,0 % sin, todas 22/22. Bancos `controles` 49/49, `sonido-worklet` 34/34, `relevo` 46/46.
- **2026-10-27 23:22** — **§144 (E6, hecho en la página): qué Hz conviene, dicho en Gráficos** (párrafo `notaHz` de `graficos.mjs`; `prueba-navegador` acepta `MKW_VENTANA` con `--ventana`). La prueba en el monitor de 144 Hz (aprobada por el dueño) midió 240 Hz las dos veces: Chrome siguió el monitor principal, no se pudo ver. Banco `graficos` 46/46. **Para el dueño:** mirar «Mostrar qué frena» con el juego en el monitor de 144 Hz.
- **2026-10-27 23:40** — **§145: las tres pruebas que fallaban de antes, arregladas (eran las pruebas, no el juego)**: `prueba-inicio` 8/14 → **15/15** (Multiplayer «en obra» desde §116 dejaba las teclas siguientes en otro botón; un punto nuevo para «en obra» y el resto con `?multi=1`); banco `controles-panel` 24/25 → **25/25** ×2 (el stick de mentira quedaba apenas encima de la zona muerta por eje de `mando.js`: ahora cada eje con ≥ 0,45); banco `mando-sitio` §106 intermitente → **11/11 ×5** (las ayudas cambian cada 500 ms: espera hasta 2 s).
- **2026-10-28 01:02** — **§146 (D3, hecho): lo que el juego espera y venía de fondo se apura** (`lote.mjs` `apurar`: a la fila urgente, o el disco lo pide aparte si va con más de 512 KB delante; `?apurar=0`). Banco `lote` 28/28: 50 ms contra 1.672. La pareja limpia en la página real queda pendiente (§151 `--arranque`).
- **2026-10-28 01:02** — **§147 (D12, hecho): el fantasma de la página de a 3 con tope de 4 s** (`?fantasmaParalelo=0`): 804 → 406 ms; banco 21/21, `prueba-fantasma` 10/10.
- **2026-10-28 01:02** — **§148 (P3, hecho): sin filtros que se recalculen encima del juego** (`html.filtros-livianos`, `?filtrosLivianos=0`); banco `cuenta-dnf` 26/26.
- **2026-10-28 01:02** — **§149 (H2, la parte de la página): el presupuesto de la gama media en el informe** (`presupuesto()` de `graficos.mjs`, `?presupuesto=0`); banco `graficos` 49/49.
- **2026-10-28 01:02** — **§150 (V3, hecho): una carrera entera, de la cuenta a la meta** (`medir-carrera-entera.mjs`): en la carrera el juego lee 2 archivos (música y fanfarria), ~15 lecturas a la red y **0 esperas**; en la meta la fanfarria y 7–8 retratos.
- **2026-10-28 01:02** — **§151 (V2, la herramienta): `medir-sitio --arranque` y `--nucleos N`**; las corridas, pendientes.
- **2026-10-28 01:02** — **§152 (V4, hecho): contadores por cuadro dentro del motor** (programa aparte `-DMKW_CONTADORES`, `?contadores=1`, `medir-contadores.mjs`): en la carrera ~1,1 millones de accesos a la memoria de la Wii por cuadro (0 lentos), 200 mil «resueltos» que en wasm siempre vuelven al revisado, 9–11 mil llamadas indirectas, 7–8 fibras; la FMA escalar no aparece.
- **2026-10-28 01:02** — **§153 (N1, hecho): el impuesto del navegador medido: ×2,2** (`compilar-nativo.py` = el mismo juego como `.exe` de Windows con clang 22 de VS 18, nunca a git; `medir-impuesto.mjs`, 3.600 cuadros, 2 vueltas): nativo 0,54 ms, wasm 1,16 ms por cuadro; la memoria revisada ~30 % de la diferencia, la FMA ~0, el resto del propio wasm ~70 %. El modo Node vuelve a enlazar (`pad_vacio.cpp`). Ojo: escena liviana (la carrera de fondo del título, sin dibujo).
- **2026-10-28 01:02** — **§154 (R5, hecho en lo seguro): la huella ampliada** (cada 30 cuadros; 12 `RaceinfoPlayer` + el azar dicen qué se separó; sin punteros; `?huellaCada=120`, `?huellaAmpliada=0`): banco `lockstep` 55/55, `prueba-sincro --directa` 13/13 (74 huellas iguales). Falta posición/velocidad/objetos (punteros de física sin verificar).
- **2026-10-29 16:25** — **§155 (H1, la parte del PC): el aparato de mentira** (`web/navegador/lastre.mjs`): `?lastre=K` (el hilo del juego K veces más lento; `?lastre=1` = solo mide la CPU pura), `?lastreAyuda=K` (el hilo del sonido, en el worklet), `?ladron=64` (un Worker que ensucia la caché grande), `?lastreGpu=K` (cada pasada K veces en imágenes de descarte). Banco `lastre` 15/15 (CPU ×2,00/×3,99, tarjeta ×2,08/×4,05). En la carrera: CPU pura 6,1 ms; K = 2 → 12,1 (×1,98); la gama media del plan (`&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6`) → 23–26 fps. aurora **recompilado**: la espera de sus búferes de subida pasa por la página solo con lastre (`mkwEsperaSubida`; sin lastre, igual que antes). `medir-sitio --puerto`. Falta el Oppo por USB: H1 en curso. Abierto: `?perfilGpu=1` en Chrome sin ventana se queda en el cuadro 0.
- **2026-10-29 16:25** — **§156 (V2 cerrado, E5 hecho)**: la carga con `--arranque` en 16, 8 y 4 procesadores lógicos y a 20 Mbit/s. **Con 2 núcleos/4 hilos, abrir el juego atrasa otra pestaña hasta 317 ms (48 veces > 50 ms): falla de verdad para la meta**; con 4C/8T o más, nunca > 50 ms. El criterio del paso 4 sigue abierto. La pareja limpia de D3: sin ganancia medible a 20 Mbit/s. E5: una sola tarjeta al cargar (`?unaTarjeta=0` = las tres de antes). `medir-sitio`: la CPU por proceso ahora sí se lee (sesión del navegador).
- **2026-10-29 16:39** — **§157 (U3 en curso, C8 descartado)**: `medir-sitio --piloto` (el piloto de la página va a la carrera de `--extra`). En este PC, la misma pista: Contrarreloj 4,9 ms de CPU pura / tarjeta 3,9; 12 karts 6,6 / 4,9: unas 3/4 del costo es la base (motor y dibujo), no los rivales. Gama media simulada: 12 karts a 23 fps. Falta el Oppo. C8: el programa queda listo 0,08 s tras bajar y la 1.ª carrera va a 60 en las dos visitas (solo este PC); V8 solo guarda lo optimizado: descartado; el calentamiento del teléfono queda abierto en H11.
- **2026-10-29 16:48** — §156/§157 completados: con el programa comprimido, 2C/4T sigue trabando otra pestaña (p99 91 ms, peor 351 ms, 38 veces > 50; criterio del paso 4 abierto: lo traba el procesador, no la descarga); la 2.ª visita trae el programa de la caché HTTP (0 MB, 17 llamadas al Worker en vez de 129). Queda abierto: `?perfilGpu=1` sin ventana se cuelga en el cuadro 0.
- **2026-10-29 17:08** — **§158 (paso 4, criterio abierto): la traba de la carga en un PC chico era casi toda la medida**: `--nucleos N` ahora le dice N a la página (`navigator.hardwareConcurrency`; antes el tope del precalentado salía de 16 → 4 en vez de 2); con el tope de verdad (2, ya en la página) la otra pestaña pasa de 38–48 trabas > 50 ms a 1–3 (p99 104 → 14 ms), la carrera a 60. Tope 1 no ayuda (no se cambia la regla). `--arranque` guarda la línea de tiempo por segundo; `--latido-aparte` (la página `data:` compartía el proceso del juego); `--chrome "…"`. Queda **una traba de ~300 ms al largar la 1.ª carrera**: V8 optimiza (TurboFan) el código de la carrera; con `--js-flags=--liftoff-only` desaparece (63 ms), pero el juego pasa a 15,0 ms por cuadro (≈8,7 sin la bandera) y la carrera a 59,2 fps: solo diagnóstico (corregido en §160). Misma causa que la 1.ª carrera lenta del teléfono (H11). Además: `perfil-gpu.mjs` llamaba con 6 argumentos y `setBindGroup` de 2 elegía la forma de 5 → con `?perfilGpu=1` el juego quedaba en el cuadro 0; arreglado (banco `perfil-gpu` 15/15).
- **2026-10-29 17:38** — **§159 (N2, la parte simulada): la escalera de mentira** (VS de 12, CPU máximo, `medir-sitio --sola --piloto`; nuevo `--piloto-espera s`): este PC 59 fps, PC típico (`lastre=2.2`, 8 lógicos) 52,7, portátil (`lastre=3&ladron=64`, 4 lógicos) 22,8, gama media (`lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6`) 17,6, gama baja (`lastre=7…`) no llega a la carrera en 15 min. La CPU pura de esos escalones es más que la de este PC por el lastre (×3 → 39 ms en vez de 21); el porqué no está probado (el escalón mezcla lastre, ladrón y 4 lógicos; corregido en §160). N2 en curso: faltan el Oppo y las metas.
- **2026-10-29 20:10** — **§160 (N13 en curso, partes 1 y 2 y la carrera del lado wasm)**: muestreador propio para el nativo (`herramientas/muestreador/`, sin administrador) + `node --cpu-prof` para el wasm, `herramientas/perfil-impuesto.mjs` y `reparto-impuesto.mjs`. En la pantalla de título, en CPU del hilo, el impuesto es **×3,4** (nativo 0,370, revisado 0,543, wasm 1,260 ms/cuadro; N1 decía ×2,2 porque medía pared). Reparto de la diferencia: memoria 19,5 %, código traducido 34,7 %, salir del wasm (JSPI, promesas, basura; en Node) 30,1 %, HLE de hilos y hora 6,2 %, sonido 5,7 %, llamadas 4,8 %, sin causa 1,4 %. Banderas de V8: sin revisiones de pila ni inlining no cambia; con revisión de límites explícita +16 %. Carrera de 12 en Chrome (solo wasm): el código del juego es el 56 % del hilo ocupado (6,3 ms/cuadro); JSPI y basura visibles 0,7 %; `(program)` 21,5 % sin repartir. Correcciones a §158 (la corrida liftoff: 59,2 fps, 15,0 ms) y §159 (el «crece más que el lastre» no está probado). Las ventanas van al monitor de 144 Hz (DISPLAY5, −1880,549).
- **2026-10-29 20:30** — **§161 (N2): el banco sin tope y el margen**: `?sinTope=1` (`web/navegador/sin-tope.mjs`; solo para medir, nunca en la sala/en línea/con red; banco `sin-tope` 16/16) suelta la cuadrícula y pide `mkw_prisa` en la carrera; cuenta cuadros de lógica e imágenes aparte. Este PC: **151,4 cuadros de lógica/s**, 74,7 imágenes/s, tarjeta 6,7 ms (no frena) → margen ×2,5 (calculado ×2,42). Los escalones simulados sin tope **no valen**: el lastre gira en las esperas y sin tope casi no las hay (giró 17–80 % de lo debido); gama baja no llega a la carrera. Margen (16,7 ÷ CPU pura) de §159: típico ×1,17, al portátil le falta ×2,36, a la gama media ×2,97. Pendiente: lastre por cuadro de lógica en el runtime.
- **2026-10-29 21:50** — **§162 (N2): el lastre por cuadro dentro del runtime y la escalera sin tope**: `mkw_lastre_cuadro(K)` en `vi.cpp` (gira (K−1)·t al empezar cada retrazado; en la carrera sin tope cuenta también lo cedido al navegador, `mkw_lastre_cuadro_todo`), parche regenerado; `?sinTope=1&lastre=K` lo usa, con tope sigue el de la página (banco `lastre` 15/15, `sin-tope` 21/21). En la carrera gira justo la mitad de la pared con K = 2, pero los cuadros de lógica bajan a ×0,70, no a la mitad (sin probar: esperas de aurora que no son CPU con K = 1). Escalera sin tope: PC típico 90,2 cuadros de lógica/s (×1,50 de sobra), portátil 38,1 (le falta ×1,57), gama media 33,2 (le falta ×1,81), gama baja no llega a la carrera. `medir-sitio --help` ya no mide; margen por cuadro de lógica; el contador de lógica ya no salta al terminar.
- **2026-10-29 22:20** — **§163 (N2): el freno calibrado y la escalera con la gama baja**: el tramo fijo `?tramo=600-2400` (carrera directa, `pista=0.0&semilla=1234&soloCpu=1`, 12 CPU; banco `sin-tope` 28/28). K = 1 en el tramo: 146,8 · 142,3 · 142,0 (±1,7 %). El freno gira exactamente (K−1) × trabajo (±0,5 %) y no hay esperas escondidas (aurora 0 ms: la suposición de §162 queda descartada); la lógica no baja a 1/K porque el juego dibuja menos cuando va atrasado (0,44 → 0,33 imágenes por cuadro de lógica): K = 2 da ×0,60 ±10 % (en el borde), K = 4 da ×0,259. No se calibra por tabla (falsearía el núcleo). Escalera: típico 80,6 de lógica/s (×1,34 de sobra), portátil 36,4 (le falta ×1,65), gama media 29,8 (×2,01), **gama baja 19,7 (×3,04), ya llega a la carrera** (directa, 135 s). La tarjeta no se pudo medir con el hilo girando.
- **2026-10-29 22:53** — **§164 (N2): la tarjeta en el tramo fijo y la segunda corrida**: con `?tramo=…&perfilGpu=1` las marcas de la tarjeta cubren el tramo (antes, 20 s); con el redondeo de Chrome apagado (`--chrome "--disable-dawn-features=timestamp_quantization"`, solo para medir) este PC da 0,200 ms por imagen con K = 1 y 0,210 con K = 4 (±5 % ✓). Escalera (cuadros de lógica/s, 3 corridas): típico 77,5–83,7 (×1,33), portátil 36,3–36,4 (le falta ×1,65), gama media 29,8–31,6 (×1,95), gama baja 18,6–19,7 (×3,14); tarjeta por imagen 0,2 / 0,2 / 1,2–1,5 / 2,8–3,3 ms contra CPU por imagen 37 / 91–102 / 151–173 / 369–377 ms: **en todos frena la CPU**. Duda: el Oppo decía ~34 ms de tarjeta (otro método); medirlo con «Perfilar la tarjeta» y recalibrar `lastreGpu`.
- **2026-10-29 23:40** — **§165: N13 cerrado.** Guion de botones en el modo sin pantalla (`MKW_HEADLESS_GUION`/`_ESTADO`/`_TRAMO`, `aurora_manual.cpp`; Node con `MKW_NODE_DATOS`): Node y el programa de Windows llegan a la misma carrera de 12 (cuadro 2998). En el tramo 600–2400: nativo 2,01 ms por cuadro de lógica (3 corridas), wasm 6,23 (±15 %) → **×3,1**; por función (muestreador + `--cpu-prof`) ×2,45: código traducido 63,7 % + RR 6,3 %, memoria 16,6 %, salir del wasm 6,4 %, despacho 3,3 %, HLE y otros 2,6 %, **sin explicar 2 %**. Sin vectorizar (`compilar-nativo --sin-vector`): +16 % = 8 % del impuesto. El `(program)` de Chrome (`--trazaV8` + `herramientas/reparto-program.mjs`): 7,9–16 % del hilo; 70–90 % con nombre (Blink 42 ms/s, mensajes 9, WebGPU 4, recolector 3, compilar 1,5), el resto dentro de las reanudaciones de JSPI. El traductor (M8, H11, M6, M7) pasa al paso 11, delante de la memoria. Desde ahora cada optimización se mide en la gama baja simulada y en este PC.
- **2026-10-30 03:00** — **§166: lo que quedaba de N13, cerrado.** La variación del wasm en Node (`herramientas/medir-node-estable.mjs`): no es la frecuencia (104–109 %), ni el recolector (0,08 ms/cuadro), ni el compilador por etapas; es la carga de fondo del PC, que cambia con la hora, y cada proceso de wasm, que arranca con el código en otro lugar. Forma de medir: `--fijo` (prioridad alta, 4 núcleos), antes/después intercalados en la misma tanda (±1,5 %); la razón por pares `--alternar v3`: **×2,63 en 25 pares** (intervalo de la mediana 2,41–2,72; el ×3,1 de §165 era deriva). Los contadores internos de V8 no existen en Node ni en Chrome («RCS was disabled at compile-time»); `--prof` nombra los Builtins, no el C++; la prueba chica de JSPI (`herramientas/micro-jspi/`): 4,8 µs de «(program)» por ida y vuelta, ~7 ms/s en la carrera. Las llamadas indirectas (`herramientas/micro-indirectas/`): 13 → 26 ns, ≤0,15 ms por cuadro (≤3,5 % del impuesto). El 158 de K = 1 fue la corrida: los cuatro casos dan 128–138. Con tope, este PC gasta 11 ms de CPU por imagen (lógica 4,4 + dibujo 6,7; meta 3,3) y la gama baja ~92 ms; la tarjeta 0,17 y 3,0–3,3 ms. El Oppo: instrucciones para el dueño en `docs/medir-oppo.md` (H1/H2).
- **2026-10-27 21:31** — **§127 (R10): la revisión de conexiones, liviana en la carrera**: `getStats` de a un piloto por vuelta en rueda y avisos al sitio solo si cambia el estado. `?conexionesRueda=0` = como antes. Banco `conexiones` 24/24; `prueba-sala --rapida` 43/43.
- **2026-10-27 21:29** — **§126 (P8, en parte): relojes que escriben solo si algo cambió**: la pastilla del mando, `leerGraficos` sin `JSON.parse` si el texto guardado no cambió, y en la sala los nombres de las CPU se leen una vez por carrera. Quedan la vigía de la cortina en la sala y el reloj de `records.mjs`. Bancos `graficos` 43, `mandos-jugador` 18, `inicio` 16, `controles` 48; `prueba-sala --rapida` 43/43.
- **2026-10-27 21:26** — **§125 (P7): el registro con tope y pintado solo si se ve**: el cuadro del cajón se pinta solo abierto (`IntersectionObserver`; antes se reescribía y se medía con el cajón cerrado) y `todoElLog` tiene tope de 20.000 líneas (se sacan 2.000 de a una vez). La línea del medidor sigue en la consola (`prueba-sincro` la lee). `?logLiviano=0` = como antes. `prueba-navegador` 22/22.
- **2026-10-27 21:23** — **§124 (V5, sin recompilar): los cuadros de lógica de la carrera**: el Raceinfo los cuenta él mismo (+0x1C en la presentación, +0x20 desde la cuenta; medido: 60/s con 54 dibujados, y con la CPU 6× más lenta 15,9 contra 2,3). `mkwEstado.logica`, el medidor («lógica N»), el informe de rendimiento y `queFrena` («el dibujo: la carrera se calcula a 60 pero se dibujan N»). `?logica=0` = sin esto. Banco `graficos` 43/43; con el juego: normal 58,9 dibujados / 59,9 lógica, CPU 6× 2,7 / 18,9.
- **2026-10-27 21:21** — **§123 (G8): el medidor de la tarjeta por ventanas** (`perfil-gpu.mjs`: cuenta 2 s de cada 10 y entre ventanas WebGPU queda con los métodos originales; envolturas de argumentos fijos; setPipeline/setBindGroup solo para «Perfilar»; el historial divide por los cuadros contados). `?ventanaGpu=0` = siempre. `medir-sitio --perfil pc` (que siempre pone `gpu=1`): CPU por cuadro 8,27 → 8,09 ms, p99 11,7 → 10,0. Las mediciones de `medir-sitio` hasta §122 tenían el contador puesto. Banco `perfil-gpu` 14/14.
- **2026-10-27 21:21** — **§122 (D13): la partida y la lista de pipelines se guardan fuera de la carrera** (`aplazarMientras` en `guardado.mjs` y `pipelines.mjs`, con la vigía de la carrera; en un rato libre con `requestIdleCallback`; esconder o cerrar guarda igual; la partida, como mucho 5 min). `?aplazarGuardado=0` = como antes. Bancos `guardado` 18/18 y `pipelines` 17/17; `prueba-partidas` 6/6; 0 tareas largas en la carrera en `medir-sitio`. **U1 no se hizo**: la página no puede pausar el precalentado de aurora sin frenar también lo que la carrera necesita (hace falta un `mkw_web_pipelines_pausa`: recompilar).
- **2026-10-27 21:16** — **§121 (D2): las descargas de fondo, en pausa durante la carrera**: `disco.pausarBaja` (la fila baja no sale; la normal y las lecturas del juego sí), la vigía de la carrera la prende y la suelta; lo que el juego tuvo que bajar en carrera queda en `mkwFaltas()` (para D1). `?pausaCarrera=0` = como antes. Medido con `herramientas/medir-fondo-carrera.mjs` (nuevo; 1.ª visita, 20 Mbit/s, 30 s de carrera): bajado en la carrera 59,1 → 28,0 MB (lo que queda es la carga de la pista del juego mismo; 17 faltas). En `medir-sitio --red 20` no cambia (la fila ya había terminado al llegar a la carrera). Banco `disco` 42/42.
- **2026-10-27 21:05** — **§120 (C10, la parte de la página): la pestaña oculta ya no gira**: `esperaReloj` dormía 0 ms (cedía por MessageChannel y volvía); ahora duerme con el temporizador de un Worker hasta el cuadro, de a 4 ms. `?esperaOculta=0` = como antes, `?ocultaMs=N`. Medido con `herramientas/medir-oculta.mjs` (nuevo; la pestaña oculta simulada en la página: Chrome manejado por pruebas no la deja ocultarse): despiertes 21.316 → 22 por segundo, hilo ocupado 78 → 59 %, mismos cuadros. `prueba-navegador 1800` 22/22. **Queda en curso**: pausar el juego en un jugador y la espera de 1 ms del runtime necesitan recompilar (un `mkw_…` que corra la grilla del reloj hacia adelante al volver).
- **2026-10-27 20:56** — **§119 (C7): la precarga de la sala sin el bloque de 124 MB**: el programa pasa por un sumidero que solo cuenta bytes (la caché HTTP se llena igual), 12 trabajos a la vez en vez de 24 y 4 MB de bloques en la memoria de la precarga en vez de 64. `?precargaLiviana=0` = como antes. Medido con `herramientas/medir-precarga-memoria.mjs` (nuevo; 100 Mbit/s, 2 vueltas): pico de la página 547 → 422 MB, al terminar 485 → 313 MB, mismo tiempo (7,2 s). `prueba-precarga` 8/8 (con el programa recomprimido: el `.br` era viejo y daba 7/8).
- **2026-10-27 20:47** — **§118 (D6 del plan de rendimiento): el almacenamiento persistente se vuelve a pedir al terminar cada carrera** (como mucho cada 5 min, hasta que Chrome lo concede; antes, una sola vez al arrancar), y el panel «Partida» dice si lo guardado está protegido y cuánto ocupa (`persistencia.mjs`; una vigía de la carrera en `mkw.mjs` que usarán otros ítems). `?persistir=0` = solo al arrancar. Banco `persistencia` 15/15; `prueba-partidas` 6/6. Si Chrome lo da «a la 2.ª visita» no se puede ver con un perfil de Playwright (su puntaje de uso no crece): lo dirá `mkwPersistencia.estado.concedido` en el sitio.
- **2026-10-27 20:42** — **§117 (C1 del plan de rendimiento): el precalentado de pipelines siempre con tope**, también en la 1.ª visita y en la sala: `tarde:2:T` con T = max(2, núcleos ÷ 4) y soltado al arrancar `main()`; `?precalentarTope=0` = el de antes. La sala (`preparacion.mjs`) espera la primera mitad de la lista y la calma, no todos. Medido en esta PC, 1.ª visita: compilándose a la vez 465 → 4, llegada media 2,5 s → 0,1 s, dibujos saltados 84 → 45, la carrera sin tirones (7 → 0); quedan cuadros de >100 ms en la carga que no son de los pipelines (C4/C6/C8). Bancos `preparacion` 20, `disco` 38; `prueba-musica` 11, `prueba-navegador` 22, `prueba-sincro --directa` 13.
- **2026-10-25 06:30** — **Reasignar todo el mando y el teclado** (§111, con un crítico). Mapa por mando con 20 controles
- **2026-10-27 04:30** — **§116.1: también las salas de Juegos** (el dueño): `SALAS_EN_OBRA` en el sitio; la tarjeta con el cartel, la ficha con «▶ Jugar solo» en vez de «Abrir sala», nadie crea ni entra, la sala por enlace muestra el cartel; `?salasObra=0` para probar. Sitio `mkw.test.cjs` 25/25.
- **2026-10-27 01:00** — **§116: Multiplayer «🚧 Trabajando para usted»** (el dueño: «está totalmente roto, ocúltalo por ahora»): en el menú de inicio queda gris con el cartel y no abre Local ni Online (teclado, mando, clic; también en el sitio); `?multi=1` lo devuelve para probar. Banco `inicio` 16/16.
- **2026-10-26 10:00** — **§115.5: el tercer informe leído con el código de aurora**: dibuja siempre en 640×528 (la salida no importa: se sacó el consejo «baja la resolución de salida»); el costo sigue a lo que se ve (5 000–12 500 dibujos de la Wii por cuadro); «juego» y «tarjeta» se contienen el uno al otro, así que falta separar cuál frena. Descartadas las lecturas sincrónicas, el MSAA y el estirado. Sigue en la sesión del PC (elegido por el dueño): medir separado y optimizar aurora. Banco `graficos` 39/39.
- **2026-10-26 09:00** — **§115: el segundo informe del Oppo dice que frena la tarjeta de video** (~34 ms por imagen, el doble de lo que hay para 60; el juego la espera). Medidor nuevo `perfil-gpu.mjs`: cuenta pasadas, dibujos, copias y KB subidos por cuadro, y «🔬 Perfilar la tarjeta de video» mide cuánto tarda cada pasada en la tarjeta (marcas de tiempo) los primeros 20 s de la carrera. Falta el perfil del teléfono del dueño para optimizar lo que se come el tiempo. Banco `perfil-gpu` 8/8 (WebGPU de verdad), `prueba-celular` 41/41, `graficos` 38/38.
- **2026-10-26 07:00** — **§114.8: primer informe del Oppo**: andando, 59–60 fps con 12,5 ms por cuadro (el motor alcanza); los primeros ~21 s, 20–37 fps (27–48 ms): un tramo de «primera vez» (código sin optimizar todavía, pipelines o disco). La pantalla a 60,4 Hz no engancha (tope 0,5 %). Informe nuevo de 2 min con disco, pipelines y etapa por segundo.
- **2026-10-26 03:40** — **Regla del dueño (§114.7): quitar rivales NO es una opción para mejorar el rendimiento** (siempre 12 karts; tampoco sacar efectos): solo optimizar el motor y la página. Anotada en `CLAUDE.md` (Reglas).
- **2026-10-26 03:20** — El dueño probó con el juego: **todo funciona** salvo gráficos y rendimiento (Controles §112, personajes con mando §111, celular §113/b, «Acelerar solo» §113c). Abierto: el rendimiento en el teléfono (esperando el informe de §114).
- **2026-10-26 03:00** — **§114: por qué el celular va a 30 fps** (pedido del dueño, Oppo Find X9 Pro): «Mostrar qué frena» (juego ms, tarjeta ms, Hz, lienzo y el veredicto, `queFrena`), «📋 Copiar el informe de rendimiento», el lienzo a 720 en el teléfono también para quien tenía «la de tu pantalla» (una vez), salida 640×360, el mando en pantalla sin repintar cada cuadro, la hoja Controles quieta con el cajón cerrado. Falta el informe del teléfono del dueño para el paso siguiente. `prueba-celular` 40/40, banco `graficos` 38/38.
- **2026-10-26 02:00** — **§113b y §113c** (pedidos del dueño): cada botón en pantalla se puede cambiar de acción («Hace: … ▾» en el editor; la columna «En pantalla» de la lista abre el editor con ese botón o agrega uno), y **«🚗 Acelerar solo»**: A apretado solo desde el «¡YA!» (en la cuenta la salida rápida es de la persona con su botón de acelerar), no en la pausa ni en los resultados, frenar le gana. `prueba-celular.mjs` 37/37; bancos del PC sin cambios.
- **2026-10-26 01:10** — **§113: el celular** (pedido del dueño): un teléfono (toque sin puntero fino) prende solo el mando en pantalla, la hoja Controles tiene «📱 Celular» (Sí/No, tamaño y opacidad −/+, inclinar, «↺ Como venía»), salida 720 la primera vez y el aviso «Gira el teléfono». **El editor del mando en pantalla como BT3**: mover, agrandar o achicar cada botón y el stick, ocultar, agregar X/Y/Z/la cruz, guardado acostado y parado por separado. El sitio: «celular y PC» (`@controles: tactil teclado`), reglas con Android. `herramientas/prueba-celular.mjs` 26/26 (Pixel 7 emulado); bancos y pruebas del PC sin cambios; sitio 1140/1140. Falta medirlo en un teléfono de verdad.
- **2026-10-25 23:30** — **§112: la hoja «Controles» de nuevo** (pedido del dueño, propuesta C de un crítico externo): pestañas por jugador, una lista de acciones con el mando y el teclado lado a lado, la luz de cada fila como probador, «Asignar paso a paso», «Probar el mando 10 s», zona muerta con − y +, sin lo del celular ni la línea de depuración. «Reasignar» no abría por un clic perdido (la tarjeta salía y volvía cada 100 ms). Las 15 fallas del crítico para el mando 100 % (la B capturada cerraba el cajón, la A volvía a hacer clic, el asistente se reiniciaba, el cajón sobre el menú de inicio…) y una más: un mando desconectado antes de soltar dejaba todos los mandos fuera del juego. Banco nuevo `controles-panel` 25/25 (la página de verdad en su marco con el `mando.js` del sitio, el cursor con el stick), `asignacion` 62/62, `controles` 48/48, `mandos-jugador` 18/18; ratón de verdad; Avanzado revisado (volumen con − y +).
- **2026-10-25 08:10** — **§111.3: la segunda revisión del crítico**: un segundo «Cambiar» ya no deja la captura huérfana (`espera === mia`), lo capturado no llega al juego hasta soltarlo, la hat con reposo 1,2857 en las 8 direcciones, el gatillo-eje que marcaba 0, lo de siempre no se guarda, el stick C del teclado sin teclas de partida, el asistente en dos (botones / sticks) con el reposo medido antes y Esc que lo cancela, cerrar el cajón cancela. Banco `asignacion` 52/52, `controles` 48/48, `mandos-jugador` 17/17, `mando-sitio` 11/11.
  (botones, gatillos analógicos, stick y stick C), captura de botón/eje/cruceta hat, por modelo (cable y Bluetooth),
  tabla con Cambiar/＋/✕/↺/Deshacer; teclado con 3 teclas y stick C. Arreglos: Esc que se colaba, guardado roto, cursor
  del sitio al asignar, Xbox como PlayStation, y **el mando en la selección de personajes** del descanso. Banco
  `asignacion` 42/42.
- **2026-10-25 04:10** — **Quien llega con la copa andando corre desde la carrera siguiente** (§110, el dueño). De paso,
  un error de antes: el que entraba tarde aparecía en la largada y el juego de todos se recargaba; ahora «¡A correr!»
  guarda quiénes estaban. `{t:"suma"}`, `sumados` con su carrera en la sala del juego, `correnEn`, `lockstep.agregar`.
  Banco `sumados` 24/24, sitio 24/24. **Falta probarlo con el juego** (tres pestañas).
- **2026-10-25 02:00** — **La resolución en pixeles y la de salida** (§108, el dueño: «resolución que pueda hasta bajar
  para aumentar fps»). El juego ya dibuja a lo mínimo del motor (640×528); lo nuevo baja el tamaño del lienzo (1920×1080
  … 960×540) contestándole a SDL3 un recuadro más chico, en el momento. Ayuda solo si frena la tarjeta de video. Banco
  `graficos` 31/31. Falta medir con el juego.
- **2026-10-25 01:10** — **Gráficos opcionales y el medidor** (§107, el dueño: «ping ms, fps, antialiasing, subirle los
  gráficos», «hasta 180 fps»). Avanzado → Gráficos: resolución interna 1–4× (es el antialiasing: supermuestreo) y
  fluidez 60/120/180 (imágenes intermedias; la física sigue a 60), al Config.toml al reiniciar; fps y ping en la esquina.
  Todo apagado por omisión: con lo de siempre el Config.toml no cambia. Banco `graficos` 21/21. **Falta medir con el
  juego** (§107.3: si la fluidez anda en la web y cuánto cuesta cada opción).
- **2026-10-25 00:21** — **Los mandos como en BT3 y la barra de descarga** (§106, el dueño: «en bt3 aparece el mando que
  uno tiene y permite seleccionar entre mandos»; «la barra de descargas con el progreso cuando se esté descargando
  algo»). «Jugador 1–4» en cada tarjeta de Controles → Mandos (se cambian de lugar, se recuerda por mando), la pastilla
  del mando abre Controles, la ayuda de la tarjeta de inicio con los botones del mando, y `descargas.mjs`: MB, total y
  velocidad cuando bajar algo dura más de 0,4 s o el juego espera. Banco `descargas` 29/29, `mandos-jugador` 17/17,
  `mando-sitio` 11/11, `controles` 47/47. Falta probarlo con el juego en la PC del proyecto.
- **2026-10-24 23:50** — El dueño publicó las reglas de Firebase (base de datos y Storage, `docs/publicar.md` paso 5). Del lado de
  las cuentas no falta nada: queda juntar la rama del sitio a `main` (paso 6) cuando el dueño lo pida, y probar como amigo
  (paso 7).
- **2026-10-24 23:49** — **Publicado del lado de Cloudflare** (lo hizo el dueño, `docs/publicar.md` pasos 1-3): el bucket propio
  `mkw-retro` con los 7.324 archivos (5,00 GB; `--comprobar` daba 325 «0 bytes» por un error del revisor, §105.1), el
  Worker nuevo pegado y el enlace `MKW`. Revisado desde aquí sin sesión: `/mkw/manifiesto.json` y `POST /mkw/lote` dicen
  401 «inicia sesión» y la pregunta previa permite POST (el código de §104). `privado.json` = el Worker + `/mkw`. Falta:
  las reglas de Firebase (paso 5) y juntar la rama (paso 6, cuando el dueño lo pida).
- **2026-10-24 23:09** — **Mario Kart en su propio bucket de R2** (§105, el dueño: «mejor creamos otro bucket para no usar el
  mismo»). El Worker lee Mario Kart del enlace `MKW` (sin él, de `DISCO`, como antes); las llaves no cambian, así que
  `subir-r2.mjs` sube igual con otro `R2_BUCKET`. El Worker local usa `MKW` y deja `DISCO` vacío. `publicar.md`: crear el
  bucket `mkw-retro` (sin acceso público), la llave solo para él y el enlace `MKW` en el Worker. Sitio `mkw-worker` +
  `bt3-disco` 19/19.
- **2026-10-24 17:21** — **Menos llamadas al Worker** (§104, el dueño: «optimiza las llamadas de descarga… 100k calls
  por dia»). Medido con el Worker de verdad en este PC (`medir-sitio.mjs`, que ahora cuenta las llamadas por visita y por
  tipo): la 1.ª visita gastaba 1.392 (696 preguntas previas: con `cache: 'no-store'` Chrome pregunta antes de cada
  pedazo) y la 2.ª 38. Ahora: `POST /mkw/lote` (Worker, `servidor.mjs`), el cartero `lote.mjs` en `disco.mjs`, los videos
  de los menús con histéresis (rellena 8 MB cuando quedan 4), las semillas por la caché del disco y los paquetes de
  imágenes guardables: **123 y 16**, la carga igual (68,9 s). La sala de dos (`prueba-experiencia`): 326 llamadas (con el
  Worker viejo, de a uno, 2.189). Bancos `lote` 20 (nuevo) y `disco` 38, sitio `mkw-worker` 11. La Tienda de Halloween
  del sitio tapaba la sala en `prueba-experiencia` (ya «vista hoy» en la prueba).
- **2026-10-24 14:05** — **El repetidor, como en BT3** (§103b, el dueño: «como en el bt3»). Sin «🛰 Todo por
  Cloudflare» ya no hay repetidor ni de reserva: el sitio dejó de mandarle al marco el TURN de §99 al armarse la sala
  (`mkw.js`; el único `relevoBt3()` es el que pide el marco en el modo) y el juego no lo escucha por otro lado
  (`mkw.mjs`). La ayuda de «Directa» sugiere el modo si a alguien no le conecta. Sitio `mkw.test` 23/23 (la de §103
  exige un solo pedido a `/turn`; la de M22 se dio vuelta), banco `red` 35/35, `prueba-sincro --directa --cloudflare`
  15/15 (962 KB por el repetidor) y `prueba-sincro --sala` 11/11 (directo, sin repetidor).
- **2026-10-24 13:50** — **«🛰 Todo por Cloudflare»** (§103, pedido del dueño: «la opción 1… no habilitada por
  defecto, tal como en el bt3 que es excepcional»). El anfitrión lo prende en «✎ Cambiar» → Conexión (`motor.js`
  `{t:"ajuste",k:"relevo"}`, `mkw.js` la fila y `&conexion=cloudflare`); la página pide las credenciales al sitio
  (`{tipo:'turn'}` → `relevoBt3()` → `/turn` del Worker) y la malla espera sin conectar hasta tenerlas (`soloRelevo`:
  `esperando` → `relevo` con `iceTransportPolicy: 'relay'`, o `normal` si no hay o no llegan en 8 s). Un TURN de
  mentira propio desde los RFC (`herramientas/turn-local.mjs`, `/turn` del banco). Banco `red` 35/35,
  `prueba-sincro --directa --cloudflare` 15/15 (una carrera entera por el repetidor, 1 MB), sitio `mkw.test` 23/23.
  La planilla del programa final de §102: 624/625 (la falla, un corte de A en la carrera 2 de `sala`, no se repitió
  en dos vueltas más: intermitente vigilada; `prueba-sala` deja el registro de la red).
- **2026-10-24 12:10** — **Listo para el PR y el programa final** (§102, pedido del dueño: «prepara todo para hacer PR
  en la paginita Pro… compilar para R2»). `main` juntado en `claude/loving-planck-9k2yam` (171 commits atrás; los
  conflictos eran listas que crecieron de los dos lados), `juegos-app.js` rearmado, `controles-datos.js` regenerado y la
  marca `@controles: teclado` (la regla nueva del Salón); la rama subida con el permiso del dueño y el PR pedido a la
  sesión de la nube. El programa final (`build/web-final/navegador`, `mkw.wasm.br` 15,7 MB) con semillas nuevas: la
  planilla dio 623/625; las dos fallas: la prueba de la largada esperaba lo de antes del relevo rápido (actualizada) y
  `sincro-sala` mostró una PC justa que pedía ponerse al día sin lograrlo (A con retraso 11-12): arreglo en
  `lockstep.mjs` (`RATOS_PRUEBA`, `GANA_MIN`, `?alcance=0`), banco `relevo` §19 (46; `correr.mjs` espera 8 min) y la
  comprobación del kart de A medida desde donde estaba. Las 4 pruebas de la red otra vez: 49/49. Lista de R2: 7.324
  archivos, 5,00 GB (solo revisada: subir es del dueño).

- **2026-10-24 05:00** — **Afinar la red** (§101, M25 punto 1, lo único que pidió el dueño). Medido con
  `prueba-relevo --trabas=8` y `?esperasLog=N` (nuevos): la traba de 1,5 s de B le cuesta a A lo que tarda la pausa en
  dos fases (~65 ms con B de retraso 7, ~300 con 3); las esperas de 1,4 y 2,9 s eran a C, que había bajado su retraso
  de 12 a 2 por los votos de B (80-120 cuadros atrás: todo le llegaba «con holgura»). Arreglos en `lockstep.mjs`: las
  banderas del informe («sé ponerme al día», «voy atrás»), quien va atrás no vota holgura, nadie se frena por quien se
  pone al día solo, y la traba propia mientras se espera no se le carga al otro ni lo corta (`?trabaPropia=0` = antes).
  Una trampa encontrada con el juego (B no volvía a manejar) y una corrección sin prueba que la distinga, sacadas. Banco
  `relevo` 38 → 44 (§11 con `ratosMalos`, §16-§18 nuevas); `prueba-relevo` 10/10 y con 8 trabas 11/11 dos veces (A
  espera a lo más 322 ms).
- **2026-10-24 03:02** — **La carrera pegada, el banco de desconexiones, «Pedir copa», los mandos del sitio y H1.4/H9/H1.2**
  (§100, M24). Lo que vio el dueño (la anfitriona se fue eligiendo personaje y el reloj llegó a 0 sin que nadie hiciera
  avanzar la sala): ahora manda una provisoria a los ~4-5 s y la carrera abre al plazo; al irse alguien cargando, la
  pantalla queda quieta ~1,4 s en vez de 15. El banco de desconexiones con el juego (11 casos: eligiendo, cargando, en la
  cuenta, en carrera, en el descanso; cierra, sin internet, sin WebRTC, solo un par). «Pedir copa» con la más pedida al
  vencer el reloj. Los mandos con el `mando.js` del sitio (banco `mando-sitio` 10). H9 (el estado entero cada 5 s en vez
  de cada 1 s: en 10 s, 2 repartos por piloto en vez de 10), H1.4 y H1.2 (`conexiones.mjs`, banco `conexiones` 19): la
  prueba de conexión encontró que la anfitriona dejaba fuera de la carrera al que le llegaba la sala por otro (su latido
  no le llegaba): ahora el puente se lo pasa (banco `sala-carrera` 101; `par-tres`: las tres corren). Y el VR: quien
  llegaba a la meta antes del minuto contaba como «ausente» y perdía como cortado aunque ganara (§100.8: `llego` en el
  lockstep; `prueba-sala` entera 45/45, `prueba-desconexion` 95/95).
- **2026-10-22 04:06** — **La red según el crítico, la carga de la sala, Intenso e Imposible y el VR por nivel** (§99, M23). La
  cortina de la sala con barra de progreso (después de abrir la lista de copas: 3 tareas largas y 241 ms en vez de 7 y
  1,4 s). La red: la autoridad por estabilidad (la ida y vuelta en el informe: el papel ya no va a quien recibe todo
  tarde; `prueba-relevo` A 4, B 5, C 9), ponerse al día (Carla con tirones de 300 ms: 0,7 cuadros atrás en vez de
  16-83), el relevo rápido (pestaña trabada 1 s: Ana espera 184 ms en vez de 983; cinco trampas encontradas en Node, ver
  §99.9), la largada pareja y la toma del anfitrión. Intenso e Imposible con tres envolturas nuevas (`prueba-sincro`
  13/13 con cada uno; medido: Intenso recorre +10,5 % sobre Máximo e Imposible +21,9 %). El VR v2 (banco `vr-sala` 58).

- **2026-10-21 17:45** — **La pantalla completa al empezar, opcional y apagada** (§98.10, el dueño después de probar con
  `jugar.bat`: «demasiado lag al abrir la lista de mapas en el host»). El modo inmersivo pone encima del juego la
  cabecera y el botón del chat con difuminado del fondo, que se recalcula sobre la imagen en cada cuadro. Ahora es un
  interruptor del vestíbulo («Pantalla completa al empezar», de cada uno, apagado por omisión) y, si alguien lo prende,
  encima del juego no hay difuminado. Sitio 20/20; `prueba-experiencia` 23/23 (Dos lo prende y Uno no: solo Dos).

- **2026-10-21 17:17** — **El «Modo consola»: antes, durante y entre carreras** (§98, M22, pedido del dueño: «haz el modelo
  recomendado» del crítico de la experiencia, más volver a elegir personaje y vehículo, opcional). El descanso pasó de
  un panel que tapaba la tabla del juego a un zócalo de una línea, y el ±VR va al lado de la fila de cada humano con la
  letra del juego (`letreros.mjs`, `filasDeTabla`). Volver a elegir: «Cambiar personaje y vehículo» en el descanso; la
  anfitriona acepta el personaje nuevo en el descanso y la carrera siguiente lo lleva en todas (trampa: el salto a la
  pantalla de personajes apagaba el «modo elección» y el juego se iba solo a otra carrera; `directo_nativo.cpp`). Los
  nombres de verdad en el juego: un agente encontró que el globo y las tablas usan el Mii de cada casilla de
  SectionParams +0x188 y que el juego solo llena la 0 («Piloto»); `nombres_nativo.cpp` carga un Mii invitado en cada
  casilla de humano (envuelve `CharacterSelect::OnInit`, `rr_overlay_8083D55C`), escribe el nombre en cada carrera (al
  final de `rr_kamek_81855954`) y le pide al juego el nombre de cada CPU («Meowser», «King Bob-omb»); la sala reparte las
  skins de RR (`estado.skins`) para quien recarga. El podio de 8 s, el cartel de quien recargó, el chip 📶 en una
  esquina, el reloj de 90 s de la copa (al vencer, una al azar), la tira del sitio con la fase real, «Terminar la copa»
  que pregunta, textos solo PC; en el sitio, el modo inmersivo al empezar la copa y la precarga del vestíbulo
  (`?precarga=1`, «⬇ 40 %» / «● listo» en la presencia del buzón): con 50 ms de red, a la carrera en 8,4 s en vez de
  10,5 s, el programa de la caché y 19,7 MB del disco en vez de 60,7. Banco `letreros` 17/17, `nombres-juego` 15/15,
  `sala-carrera` 75/75; `prueba-sala` 42/42 (`--recarga` 38/38, `--rapida` ~2,5 min), `prueba-precarga` 8/8,
  `prueba-relevo` 10/10 (el chip 📶 puesto toda la carrera la hacía fallar: ahora 6 s); sitio 20/20,
  `prueba-experiencia` 22/22 y `--playlist` 24/24 (el echado cortaba la actualización del sitio: arreglado).

- **2026-10-21 14:17** — **El vestíbulo nuevo de la sala (la propuesta D) y las opciones de menos a más** (§97, M21,
  pedido del dueño). El orden de la cilindrada y la CPU, de menos a más (sitio `2a06fc6`). Para el rediseño: tres
  maquetas en una página publicada, un crítico aparte que las midió con 2 y 12 pilotos y tres anchos (C > B > A,
  ninguna tal cual) y su mezcla D, que eligió el dueño. Programada en `colabtex/src/juegos/mkw.js`: la ficha de carrera
  (titular con la letra de la portada, «¡A correr!» grande o la espera del invitado), «✎ Cambiar», la última copa con
  «Ver tabla», los pilotos en dos columnas (`ctx.avatar`, corona, VR, «⋯» con pasar anfitrión y echar), «N de 12» con 12
  puntitos y «+ N CPU · nivel»; con la copa andando, la tira. Estilos propios (`ponEstiloVest`, `.jg-mkw-vest.jg-mkw2`,
  `@container`), lo abierto en la firma y el foco que vuelve. Sitio 19/19; `prueba-experiencia` 20/20, `--playlist`
  22/22 (la tira no decía «1 de 12»: corregido).

- **2026-10-21 02:33** — **Los niveles de la CPU: las perillas, una dificultad más alta y el nivel como ajuste de la
  sala** (§96, M20, pedido del dueño). Un agente catalogó en el código traducido todas las perillas de la IA (velocidad
  base 70 + adv que reemplaza la del vehículo, elástico contra la mejor CPU, arrebato, ayuda de cola, lo que depende del
  nivel en el código, la tabla de objetos de la CPU). La página tiene 4 niveles más altos que los del juego
  (`web/navegador/dificultad-cpu.mjs`; `web/juego/cpu_dificultad_nativo.cpp` envuelve `rr_overlay_8073ACA8` y
  `rr_overlay_807BB42C`, con guardias y reponiendo lo del juego en cada carrera): máximo = la fila difícil + base ×1,14,
  bias 0, arrebato siempre y toda la carrera, tinta 1, objetos del humano. Medido (`medir-cpu-niveles.mjs --etiqueta
  m20`, 48 carreras de 12 CPU): fácil −6,0 %, difícil +8,4 %, máximo +14,0 % que normal; ruido entre corridas ~2 %. El
  sitio ofrece «CPU» aparte de la cilindrada (máximo por omisión, `&cpu=`); `REGLA_CPU.anclas` = 3000/5000/7400/9400.
  Hallazgo: fuera de línea Retro Rewind toma el «espejo» del menú como su 100cc, así que el «Espejo» de la sala corría
  100cc; ahora la marca va en la carrera después de Pulsar (`rr_kamek_81855954`) y es espejo de verdad. Pruebas: banco
  37/37 (`dificultad-cpu` 21, `vr-sala` 47), sitio 19/19, `prueba-directa` 13/13, `prueba-sincro --directa
  --cpu=maximo` 13/13, `prueba-sala --cpu=maximo` 35/35, `prueba-playlist` 20/20. El programa final y R2: el dueño.

- **2026-10-20 18:47** — **El VR con el puesto general: las CPU cuentan** (§95, M19, pedido del dueño). Cada CPU es un
  rival de VR fijo (`REGLA_CPU` de `vr-sala.mjs`: difícil 5000, normal 3000, fácil no cuenta); contra cada una, la curva
  del juego; lo de las CPU se suma entero y vale `trunc(2·S/max(8, n))` (1/4 de humano cada una, todas juntas a lo más
  2 humanos). Con 2 humanos y 10 CPU difíciles: 1.º +39, 2.º detrás del humano +13, 12.º −39. Un crítico externo
  revisó la matemática: confirmó el equilibrio (al 90 % contra las CPU, ~8200; siempre 1.º, se para en ~11 600), corrigió
  un ejemplo del borrador, y de sus recomendaciones salieron el tope, las fáciles fuera, la normal en 3000, la regla en la
  foto de la carrera (`vrCarrera.cpu`, `reglaCpuDe`), los puestos creíbles y «humano sin puesto = cortado». La granja con
  una cuenta alterna quieta bajó de 10 483 a 5340 en 2000 carreras. Banco `vr-sala` 46/46, banco entero 36/36;
  `prueba-sala` 35/35, `--recarga` 34/34 (la foto de B con dos tomas: una línea del piso parecía pantalla partida),
  `prueba-playlist` 20/20.

- **2026-10-20 17:44** — **El descanso entre carreras, el VR a la vista y la parrilla de Mario Kart** (§94, M18, pedido
  del dueño). 30 s de descanso con su panel en copa y playlist (la cuenta, y cada humano con puesto, puntos y VR antes →
  después); agregar o sugerir con menos de 15 s por delante la vuelve a 15 s; los plazos con la hora de la anfitriona
  (`sala.restan`). La parrilla: el juego larga según el «puesto anterior» `+0xE1` (medido: `herramientas/medir-parrilla.mjs`)
  y en la sala nadie lo escribía desde la 2.ª carrera; ahora la llegada viaja en el estado y cada consola la escribe antes
  de abrir la siguiente. El cerrojo de los botones: con A en los resultados el juego abría su menú 0x22 a los ~11 s y
  largaba otra carrera (`herramientas/medir-resultados-a.mjs`). Banco `sala-carrera` 64/64, `sala-playlist` 37/37;
  `prueba-elegir` 69/69, `prueba-sala` 35/35 (`--recarga` 34/34), `prueba-playlist` 20/20, banco entero 36/36 páginas.
  Solo JavaScript: el programa no cambia.
- **2026-10-20 16:40** — **El programa final con §90–§93, y todas las pruebas: 492/492** (§93.7). Recompilado en
  `build/web-final/navegador` (las semillas de §89 siguen sirviendo); `correr-todo` con `MKW_BUILD` del final: 33
  pruebas, 492 bien, 0 mal, con las nuevas `doce`, `fantasma`, `sincro-largada` y `trofeos`.
- **2026-10-20 15:41** — **C4 y E2 cerradas** (§93). C4: en los primeros 600 cuadros de cada carrera el margen de corte
  es 15 s (`?largada=N`; hasta 45 s si la página contesta) y la malla ya no corta un WebRTC sano porque el buzón dejó
  de ver a alguien (la traba de 6 s rehacía la conexión: ~11 s de carrera quieta; ahora 6). Banco `lockstep` 47/47,
  `red` 28/28, `prueba-sincro --directa --traba-largada=6000` 15/15. E2: los ~600 archivos diminutos van en un solo
  paquete (`diminutos.bin`, 1,5 MB: listos a los 6 s en vez de ~35); en el sitio local, de los menús a 20 s de carrera,
  2531 → 1363 pedidos al Worker y 1 tirón de 29 ms. Banco `disco` 38/38, `prueba-subir-r2` 23/23. Probado y descartado:
  subir la fila baja a la normal al entrar a la carrera (más espera: llena la bajada).
- **2026-10-20 15:01** — **La Contrarreloj contra el mejor fantasma de la página** (§92, D8, pedido del dueño): el récord
  nuevo sube su `.rkg` a Storage (`mkw/fantasmas/<pista>-tt150/<uid>.rkg`) y la pantalla de fantasmas pone el del
  primero de la tabla en lugar del experto (`fantasma_pagina_nativo.cpp` envuelve `LoadCorrectMainGhost`, estado 9).
  Banco `fantasma-pagina` 19/19, `prueba-fantasma` 10/10, `mkw.test` 18/18. **Las reglas de Storage las publica el dueño.**
- **2026-10-20 14:44** — **Doce jugadores en la sala** (§91, C9, pedido del dueño): del 5.º humano en adelante, el mando
  virtual de su puesto (el portador de la CPU y los remotos del juego, alimentado en cada cuadro con la cuenta del
  mando de GameCube); arreglados los dos derrames del juego con más de 4 locales (la lista de humanos de la IA e
  `InitScreens`). `prueba-doce --n 5` 10/10, `--n 12` 11/11; el sitio con cupo 12.
- **2026-10-20 13:21** — **C8: los trofeos y fantasmas de RR ya se guardaban** (§90): Pulsar escribe todo en la carpeta
  del mod, que `guardado.mjs` copia entera; `RRRating.pul` es solo del en línea del juego. `prueba-trofeos` 9/9.

- **2026-10-20 05:07** — **El paso 0 de publicar, hecho** (§89). Con §86, §87 y §88 commiteados, el programa final
  (`--final --carpeta build/web-m8 --salida build/web-final/navegador`, 19 de 590 archivos recompilados): `mkw.wasm`
  121,7 MB → **15,7 MB** en brotli. Semillas con tres partidas sobre ese programa (VS copa 0, VS copa 13, la carrera
  directa de la sala): **713 pipelines**, 419 bloques vistos y 143 repetidos (36 MB). `correr-todo` con
  `MKW_BUILD=build/web-final/navegador`: 432/435; las 3 fallas eran la carga (banco `lockstep`, solo 42/42), la
  planilla corriendo `prueba-navegador` 15 s cuando el sonido de §88 centra la cola pasados ~20 s (con 30 s 21/21:
  la planilla ahora usa 1800) y la cuenta «9 ✓ · 0 ✗» de `prueba-nube` que la planilla no leía (pasaba 9/9). Repetidas:
  65/65, o sea **443/443**. El sitio entero con el final por el Worker de verdad y el kit al día: `prueba-experiencia`
  **20/20** y `--playlist` **22/22**. La lista para R2: 7.324 archivos, 5,0 GB. Queda B7 (el dueño).
- **2026-10-20 03:50** — **El sonido por AudioWorklet** (§88; E1). El runtime ya no abre el sonido de SDL3: le pide a la
  página que lo abra (`audio_backend.cpp`, parche `runtime-web.diff`: SDL3 solo convierte 32 → 48 kHz con el ajuste de
  ritmo) y cada entrega de 3 ms va por mensaje (sin memoria compartida: el sitio no tiene COOP/COEP) a un AudioWorklet
  (`web/navegador/sonido-worklet.js`) con una cola adaptable: reposo 25 ms, arranca en 80, sube con un corte que se oye
  y baja con la calma solo si la cola nunca bajó de 8 ms en 4 s. Medido con un clic de prueba de punta a punta: **177 →
  60 ms** (prueba del navegador) y **170 → 56–62 ms** en la carrera de la página real (`herramientas/medir-sonido.mjs`),
  0 huecos en título, arranque y carrera, también con la CPU frenada 2×. Arreglado de paso: otro AudioContext de la
  página (los pitidos DNF) se quedaba con el volumen y el medidor del juego. `?audio=viejo` = lo de antes. Pruebas:
  banco `sonido-worklet` 34/34 (nuevo), `sonido` 14/14, banco entero 35/35 páginas, `prueba-navegador` 21/21 (monitor
  a 171 Hz; 22/22 a 240 Hz), `prueba-musica` 11/11.
- **2026-10-20 03:15** — **Los 6 Mii invitados en «Mi Mii», con las caras que dibuja el juego** (§86; M10). Los
  invitados son la tabla de la librería de caras (0x8024C4D0, 6 × 74 bytes, el formato de RFL_DB.dat) y sus caras las
  dibuja `MiiRenderMgr` y las copia a una textura (96×96, RGB5A3) que aurora deja solo en la tarjeta de video. El gancho
  `invitados_nativo.cpp` hace lo de «Elige un Mii» (MiiGroup propio + `LoadDefaultMii(i, i)`) en un cuadro de menú y
  baja cada copia en ese mismo cuadro (`aurora_flush_efb_copy_to_ram`); para eso abre el montón de la escena (estaba
  cerrado: «DAME DAME»), lo pone de montón actual y marca la sección «armándose» (si no, las caras quedan en fila para
  otro cuadro), y lo deja todo como estaba. Cuesta 40–52 ms en un cuadro, una vez por navegador; las caras quedan en
  IndexedDB (nunca a git ni a R2). «Mi Mii» ofrece los 6 con su imagen («+ Mii nuevo» o «Cambiar por un Mii invitado»,
  que conserva el id y el nombre de la licencia); la licencia nueva usa el elegido, y en la primera visita su Mii toma
  la cara del invitado apenas llegan. Banco `mii-invitados` **41/41**, `prueba-invitados` **13/13** (el juego carga para
  la licencia el Mii con lo del invitado D y, en una partida nueva, el F), `prueba-arranque` 13/13.
- **2026-10-20 02:59** — **La sala: la playlist arrancaba solo al anfitrión, el cupo sin preguntar y echar** (§87).
  En la playlist, con un perfil nuevo, el selector de sugerir de los demás esperaba los nombres de las pistas (bajados
  por el Worker) y mientras tanto cada estado nuevo de la sala abría otro; al confirmar se cerraba uno solo y el otro
  quedaba encima de la pantalla de personaje. Ahora una marca impide abrir dos y el selector se cierra solo si ya no hace
  falta (`mkw.mjs`). La ficha del sitio ya no pregunta «Pilotos»: toda sala nace con 4 (el máximo de la carrera
  sincronizada; más de 4 humanos = C9). El anfitrión tiene «Echar» (jugada `{t:"echa"}`, válida solo si la escribe el
  anfitrión de ese momento) y la votación ⏏ aparece en Mario Kart con 3 o más; al echado se le cierra el juego, los
  demás lo cortan de la carrera al momento (`{tipo:'fuera'}` → `lockstep.saltar`) y la sala del juego lo deja fuera
  (`sala-carrera.mjs` `quitar`). `prueba-experiencia --playlist` 18/19 → **19/19**, `prueba-experiencia` **20/20** (echado
  con la carrera andando: cortado en el cuadro 744 y Uno siguió), `prueba-playlist` **18/18** (B como perfil nuevo),
  banco `sala-carrera` **49/49**, `mkw.test` **17/17**. El ensayo usa otros puertos de emulador (`--emu-desplazar
  10000`) para correr con `jugar.bat` abierto.
- **2026-10-20 02:36** — **El aviso de «PC lenta» de `prueba-sincro` era la PC, no el código** (§85). El código de §70 (`c6c4b89`), compilado hoy aparte (`build/viejo-c6c4b89`), da el mismo 10/11; en §70 la prueba ya iba a 52–55 cuadros/s y pasaba por la banda sin aviso (50–55). Medido por proceso: una carrera sola ~9,5 ms de CPU por cuadro, dos sueltas a la vez también (no se estorban), dos en la sala 15–17 ms cada una («todo a la vista» de §61 + «dibujar siempre» de §62; con `&arreglos=0` vuelven a 60); la tarjeta al 62 %. La PC tenía 18–28 % de CPU y ~50 % de la tarjeta ocupados por otros programas (TextInputHost trabado, Opera GX, Discord transmitiendo), y otras sesiones con juegos y compilaciones. El punto ahora pide **avisos ciertos**: ningún «espera al jugador» y cada «Tu PC no alcanza» respaldado por el medidor de esa pestaña (bajo 50 durante 6 s). `prueba-sincro` **11/11** (02:32: avisos ciertos a 52–54 cuadros/s; y 02:21 con otras pruebas encima); `--directa` 12/13 por la C4 (A trabada 5–9 s al largar, cortada en el cuadro 20). Riesgo 11 nuevo: la sala cuesta ~15 ms por cuadro en este procesador.
- **2026-10-20 02:04** — **Multiplayer local directo (M8) y los 200cc de la sala (D1)** (§84). Local abre un submenú
  2/3/4 Players en el menú de inicio y salta directo al registro de mandos del juego (sección 0x54). Antes del salto,
  `directo_nativo.cpp` hace lo mismo que el botón del menú principal (`ResetSectionParamsAndRacedataScenario1`,
  0x808516BC, con la cantidad de jugadores; `mkw_directo_locales`); sin eso salía el cartel «mando interrumpido». Banco
  `inicio` 15/15, `prueba-inicio` 14/14. D1: medido con el juego, la «100cc» de la sala corre como 200cc en RR (avance
  de las CPU en el cuadro 1500: 1,1707 en 150cc, 1,2178 en «100cc»); el sitio la llama 200cc (Paginita-Pro
  `3fa0816`). D2 ya estaba (§74); C4 sin repetirse.
- **2026-10-20 01:40** — **Todo al sitio** (§82.6). `subir-kit.sh` llevó a `terceros/Paginita-Pro/juegos/mkw` lo de
  §80/§80b (relevo y sincronía de tiempo), §81 (ayuda de la tarjeta de video), §82 (el VR de la sala) y §83 (las copas
  al azar). En el sitio, `mkw.js` (`{tipo:'vr'}`, `pideVrs` al terminar) y `reglas.js` («Tu VR»). El bundle
  `juegos-app.js` ya estaba al día: rearmado aparte, idéntico byte a byte. Pruebas del sitio: Mario Kart 22/22, todas
  977/978 (la que falla es de Worms y del separador de ruta de Windows, no de Mario Kart). `prueba-experiencia` 17/17.
  Commit local en el sitio (`9a8bb31`) solo con archivos de Mario Kart, sin push. El `.wasm` con §83 lo sube el dueño a R2.
- **2026-10-20 00:58** — **Las copas que se separaban (C2)** (§83). La copa al azar 65.0/75.0/39.0/74.1 (semilla
  3549642503) se separaba cerca del cuadro 6100 de la carrera 1. El vigía del reloj (`MKW_DEPURAR_RELOJ=1`,
  `depurar_reloj.cpp`) anotó quién lee la hora del procesador durante la carrera. Casi todo era sonido, pantalla o el
  menú HOME, pero Retro Rewind **llama** a `OS::GetTick` (0x801AAD74) en dos lugares que deciden la carrera: el
  sorteo de reserva de los objetos de Pulsar (cuando el objeto que tocó no tiene cupo; en el cuadro 5975 en las dos
  pestañas) y los objetos condicionales de las pistas retro. `RELOJ_CARRERA` solo cubría las copias que van dentro de
  cada función. Arreglo: envoltura de `OS::GetTick` en `lockstep_nativo.cpp` (el reloj de la carrera mientras hay
  carrera sincronizada) y la semilla de Pulsar (0x818A0C28) en cero al empezar cada carrera (`semillas_nativo.cpp`),
  con una revisión en `compilar-web.py`. Esa copa 4/4 (huellas 116/116) y 4 copas al azar 16/16, ninguna separada.
  Antes, un corte perdido de §80 que encontré aquí lo arregló la sesión de la sala (`a8212f3`). Commit local, sin push.

- **2026-10-20 00:15** — **La sincronía de tiempo, prendida** (§80b; M17). El dueño eligió prenderla por omisión
  (`?sincroTiempo=0` la apaga). Banco `relevo` 27/27 con ella y sin ella (promedio del retraso de Carla con tirones:
  6,3 y 5,9 contra 10,0 y 10,4), `lockstep` 42/42. Commit local, sin push.

- **2026-10-20 00:00** — **La sincronía de tiempo, a prueba, y el corte que no llega** (§80b; M17). Pedido del dueño
  (la tarea que propuse al cerrar §80): que los tirones de uno no se le sumen en el retraso. Con `?sincroTiempo=1` el
  que va adelante de uno que se quedó atrás por un tirón suyo se frena un cuadro de vez en cuando hasta alcanzarlo; el
  desfase se mide de ida y vuelta (lo de la red se cancela) y nunca se frena por uno que espera lo de los demás. Banco
  `relevo` parte 9: el retraso de Carla con tirones en promedio 5,7-7,0 con la sincronía contra 9,8-10,4 sin ella
  (Ana y Beto al 97 %). Con el juego: `prueba-sincro --directa` A en promedio 5,6 contra 11,8; `prueba-relevo` 10/10
  (A y B a 57,6 cuadros/s, retrasos 4,0 y 4,6). **Queda apagada hasta que el dueño elija** (mi recomendación:
  prenderla tras probarla en dos PC). Y un hueco de §80 que encontró la sesión del selector: el aviso de un corte se
  perdía con la conexión caída; ahora los cortes se repiten, la huella no se compara con un cortado y, si la red se
  parte, sigue la isla más grande (banco `relevo` parte 10, 3/3). Mirado cómo lo hace Mario Kart 8 Deluxe (no es
  lockstep: cada uno maneja su kart y adivina los demás; Pia resincroniza el reloj tras un pico de CPU). Banco `relevo`
  27/27 y `lockstep` 42/42 con la bandera apagada y prendida. Commit local, sin push.

- **2026-10-19 23:30** — **El VR se mueve con las carreras de la sala** (§82; pedido del dueño: «que el VR (y BR) se
  mueva con las carreras de la sala y quede guardado en Firebase»). La regla original de Mario Kart Wii, sacada del
  juego: pares de humanos, curva 0/1/8/50/125, paso 1/4999, truncado; 13 contra uno igual. Quien se corta pierde contra
  todos y nadie gana por él (RR); BR no cambia (no hay batallas). La anfitriona congela los VR al empezar cada carrera;
  cada página guarda el peor caso al abrirla y el de verdad al terminar, solo el suyo (localStorage `mkw.vr.<uid>` +
  Firebase). Comparado contra el juego mismo con un gancho de prueba (`mkw_vr_prueba`): las 19 997 diferencias iguales
  (`prueba-vr` 7/7; encontró el paso 1/4999, no 1/5000). Banco `vr-sala` 27/27; `prueba-sala` 29/30 con 4 puntos del VR
  (el ✗ era la prueba: comparaba relojes leídos en distinto momento; ya corregido). Sitio: el vestíbulo muestra el VR
  nuevo, el manual lo explica.

- **2026-10-19 23:09** — **Un jugador lento no frena a los demás** (§80; M17). Pedido del dueño: «que cada uno retrase y
  laguee al resto es imposible de jugar», pensado con un crítico (encontró 3 errores graves en la primera propuesta, los
  tres podían separar las copias de la carrera). `lockstep.mjs`: cada uno elige y ajusta SU retraso con lo que miden
  los demás (holgura, informes de medio segundo, mayoría, votos descontados, lo heredado no cuenta); la autoridad releva
  al atrasado en su propio paquete (botones de verdad o inventados) y, si la lenta es ella, pasa el papel; el corte en
  dos fases pregunta a todos, deja quieto a cada uno y no cambia nunca; quien ya corrió más allá se sale solo de la
  carrera; la huella compara también los botones. Margen de la sala 30 → 2 s; avisos 📶; `?relevo=0`;
  `?redMala=…,ida`. Banco `relevo` 21/21 (consolas a ritmo: red mala, PC lenta 100 % contra 50 % sin relevo, apagón,
  autoridad lenta, corte tardío), `lockstep` 42/42, `red` 26/26; con el juego `prueba-relevo` 10/10 (A y B a 59,6/59,5
  cuadros/s sin esperar con C a 140 ms y 5 % perdido; tirón de 1,5 s sin cortes; de 3 s, corte en el mismo cuadro y
  aviso). Commit local, sin push.

- **2026-10-19 22:56** — **La guía de publicar al día** (`docs/publicar.md`): paso 0 nuevo (el programa final se rearma
  justo antes de subir, con las semillas y todas las pruebas: el código cambió mucho desde §65), el juego sale para PC,
  la sala de hoy (copa/playlist, hasta 4 + CPU) en vez del VS de Retro WFC, `prueba-experiencia` con 17 puntos.
  `prueba-subir-r2` 22/22 (R2 falso).
- **2026-10-19 22:54** — **La ayuda de la tarjeta de video aparece sola cuando hace falta** (§81; D4). Si el juego va
  lento un buen rato por trabajo de esta PC (8 de los últimos 12 segundos de juego con < 54 cuadros y > 12 ms de
  trabajo; fuera del arranque, del disco, de la pestaña escondida y de la sala) y Windows es quien elige la tarjeta (y
  no dio una NVIDIA), un aviso abajo a la izquierda ofrece «Ver cómo» (abre Avanzado → Video) y «✕» (7 días)
  (`aviso-gpu.mjs`; banco `aviso-gpu` 18/18; probado en la página de verdad). Y el dueño decidió: **los celulares quedan
  fuera del lanzamiento** (big update lejano): marcado en `PLAN.md` (E4) y `CLAUDE.md`.
- **2026-10-19 21:27** — **El kit con §78 al sitio y la foto que parecía partida** (§79.5). `prueba-experiencia` daba 16/17:
  con el kart quieto en la largada, la raya de la meta caía a media altura y el detector la tomó por la costura de la
  pantalla partida. `foto-pantalla.mjs` recorta las barras negras (§79) antes de medir, y la prueba saca dos fotos con
  los karts acelerando: partida solo si las dos la muestran. `prueba-experiencia` 17/17. Commits locales, sin push.
- **2026-10-19 21:17** — **El contador de los que faltan, con los números de la cuenta de salida** (§78; M16). Pedidos del
  dueño: un contador que meta presión, que el plazo lo dispare el primer corredor aunque sea CPU, que se parezca al
  juego (con un crítico) y con los números de la cuenta de salida. `dnf.mjs` muestra los segundos sobre la imagen 16:9
  del juego (al 20 % del alto, con halo), «¡LLEGÓ EL 1.º!» / «¡A LA META!», la entrada de la salida en los últimos 10 y
  pitidos en los últimos 5; a quien ya llegó, «ESPERANDO A LOS DEMÁS». Las letras salen de la fuente que el juego ya
  cargó (`fuente-wii.mjs` abre `UI/Font.szs` de RR en la página: Yaz0 → U8 → BRFNT → IA4): el 3-2-1 de la fuente de
  la cuenta (solo trae 1-3), el resto de `kart_kanji_font`; colores de `go.brlyt` y entrada de `go_fade_in.brlan`.
  Nada del juego a git. Banco `cuenta-dnf` 25/25 (fuente de mentira), `prueba-sala` 26/26. Commit local, sin push.
- **2026-10-19 21:03** — **El kit al sitio y «Jugar la Copa» a la vista** (§79.4). `subir-kit.sh` con §74–§79;
  `prueba-experiencia` se cortaba: en el sitio el marco (100vh − 120 px) aparece debajo del vestíbulo y el panel de la
  copa, pegado abajo del marco, quedaba fuera de la ventana. Ahora el sitio desplaza la página para ver el marco entero
  al aparecer y cuando el juego abre un selector de la sala (`{tipo:'mirame'}`). `prueba-experiencia` 17/17,
  `mkw.test.cjs` 16/16. Commits locales en los dos repos, sin push.
- **2026-10-19 20:55** — **La cortina de Lakitu tapa toda la imagen: el juego es siempre 16:9** (§79). El dueño vio en el
  sitio, con el marco casi cuadrado, que al caerse la cortina de rayas cubría solo la franja del medio. Causa: SDL3
  agranda el canvas a su recuadro con cada cambio de tamaño, y el «aspecto dinámico» de WiiCompiled estiraba la escena
  3D mientras lo 2D (cortina, HUD) quedaba en 16:9 al medio (la prueba de §68 nunca cambiaba el tamaño). Arreglo:
  `force_16_9 = true` en el Config.toml que arma la página (`?aspecto=libre` = lo de antes): la imagen es 16:9 con barras
  negras de aurora, sin costo de GPU, y todas las consolas de la sala con la misma cámara. `prueba-caida` cambia el
  tamaño en carrera y mide los 4 bordes: 7/7 alta (900×1100) y ancha (1800×760); con `aspecto=libre` 5/7 (el bug).
  `prueba-tactil` 16/16, `prueba-navegador` 21/21.
- **2026-10-19 20:38** — **El reloj de los que faltan («DNF»)** (§77; M16). Pedido del dueño, como en las carreras en línea de
  Mario Kart 8: cuando el primer humano cruza la meta, los demás tienen 30 s; al vencer, el juego les termina la carrera
  en el puesto en que van (tiempo estimado), en el mismo cuadro en todas las consolas (`lockstep_nativo.cpp`). Y un
  error de §73 que destapó la tabla: la vigía de fin de carrera podía ver los resultados de la carrera ANTERIOR y
  avisar «terminé» al empezar la siguiente (la anfitriona habría saltado 9 s después; la tabla salía con 73): ahora
  recién vale después de ver la carrera nueva corriendo. `prueba-sala` 25/25 (B termina 30,0 s después de A; 146
  puntos). Commit local, sin push.
- **2026-10-19 20:34** — **El selector nuevo, conectado en la sala** (§74.7). Copa: el anfitrión elige una copa del juego
  (sus 4 pistas). Playlist: el anfitrión arma la lista y los demás le sugieren pistas (la lista y las sugerencias viajan
  en el estado: el anfitrión nuevo sigue con ellas); recién al confirmar se elige personaje; entre carrera y carrera, el
  panel de la playlist con «+ Agregar pistas» (los resultados esperan hasta 60 s) o «Sugerir pista». Banco
  `sala-playlist` 33/33 (nuevo), entero 29/29; `prueba-elegir` 65/65; `prueba-playlist` 17/17 (nueva, dos pestañas);
  `prueba-sala` 25/25.
- **2026-10-19 20:35** — **La música bajo el menú JloKart suena antes** (§76). Del menú a la música: 1.ª visita 8,6 → 5,5 s
  (semilla del arranque: lo que el juego lee hasta su título, pedido de una vez), con caché 5,4 → 3,2 s (los ~700 pipelines
  se precalientan recién al llegar al título, `MKW_PRECALENTAR=tarde`, solo si el navegador ya jugó). Fantasmas del
  Contrarreloj por carpeta (`disco.mjs`). `prueba-musica.mjs` 11/11, banco `disco` 33/33.
- **2026-10-19 20:12** — **Volver a la sala tras recargar, la carrera que termina sola y la copa con sus puntos** (§75; M11,
  M15). Quien recarga se salta la carrera en curso y vuelve en la siguiente con su puesto, lo que eligió y los puntos;
  la anfitriona que recarga pide la copia del estado (latido cada 1 s, plantel `fuera` por carrera, `saltar`,
  `dame`/`copia`). Error grave que vio el dueño: la carrera no terminaba si un humano no llegaba; ahora rige el tiempo
  límite del juego en línea (5:00) en el mismo cuadro en todas, sin echar a nadie. Los puntos: el juego los sumaba
  solo al llenar la pantalla de resultados y la 2 sumaba desde cero (el "de antes" lo pone un menú que la sala se
  salta): se suman una vez al terminar, con el "de antes" en la ficha, y la tabla de la sala para quien recargó.
  Pruebas: banco `sala-carrera` 46/46, `lockstep` 42/42, entero 28/28; `prueba-sincro --directa` 13/13; `prueba-sala` 25/25 (copa entera, B quieto en la 2:
  termina a los 45 s de prueba, 146 puntos) y `--recarga` 27/28 (el que falla: un aviso de espera por el PC cargado);
  detector de pantalla partida sin falsos positivos por la raya del globo del nombre. Commit local, sin push.
- **2026-10-19 20:03** — **El selector de pistas rehecho con dos revisiones críticas** (§74). Modo lista: hasta 32
  pistas (un clic agrega, otro quita, con sonido), listas guardadas con nombre, borrador que sobrevive a recargar,
  siempre a la vista (hoja abajo en el celular; la Copa 79 ya no queda tapada) y sin lag (fotos precargadas: antes
  P90 335 ms y hasta 1,5 s). Modo copa: un panel fijo con el videíto de cada pista, el plano de minimapa, 4 miniaturas
  para recorrerlas una por una (avanza sola cada 4 s, ← →) y «Jugar la Copa N»; un clic marca y el botón confirma; la
  tira de 4 fotos en cada tarjeta. Playlist: el anfitrión acepta o rechaza sugerencias y los demás sugieren
  (`playlist-sala.mjs`). Un jugador con lista de N carreras. Sitio sin «Carreras». Banco `lista-pistas` 43 y
  `playlist-sala` 25, `prueba-elegir` 59/59, `prueba-copa --cinco` 13/13, sitio 37/37. Falta conectarlo en la sala.
- **2026-10-19 17:45** — **La sala nueva probada en la página de Juegos de esta PC** (§73.8). `prueba-experiencia`
  (el `jugar.bat`) recorre ahora la sala sin Retro WFC con dos cuentas: vestíbulo «2 de 4» → la anfitriona arma la copa
  con el selector → cada uno elige en el juego → la carrera 1 directo, parejos y con una vista cada uno (16/17; con el
  cupo arreglado `--rapida` 10/10). Encontró dos cosas: el bundle `juegos-app.js` era el de §72 (rearmado) y la sala
  quedaba de 2 (nueva opción «Pilotos», 4 por omisión). Banco 26/26. Commits locales, sin push.
- **2026-10-19 17:24** — **La sala sin Retro WFC, con todos largando juntos y una sola vista por consola** (§73; M12–M14, M9, C1).
  Pedido del dueño: nada del Wi-Fi del juego; vestíbulo de la página → la anfitriona elige la copa con el selector de
  la página → cada uno elige personaje y vehículo en el juego → carrera, y que todos empiecen al mismo tiempo. Hecho:
  `?modo=sala` (`sala-carrera.mjs` = el árbitro, manda el anfitrión, cambio de anfitrión sin recargar), el juego directo
  en la pantalla de personaje (envoltura de `SectionMgr::Init`), cada carrera directo con la ficha, humanos de verdad en
  todas las consolas (`GetFirstDeactivatedPad` envuelto, derrape por mando), aviso de espera al largar, el lockstep
  suelta la espera al cambiar de carrera (el interbloqueo de la carrera 2), la recursión de la anfitriona al elegir, y
  la pantalla partida (la `RacedataScenario::Init` de RR reescribía los conteos: lo encontró el punto de vigilancia;
  1 pantalla + 1 local por consola; los globos del HUD se caían con 2 locales). Sitio: `srcMkw` → `modo=sala`, 2 modos,
  cupo 4, nombres y anfitrión por mensaje (`mkw.test` 16/16). Pruebas: banco `sala-carrera` 23/23 y `lockstep` 37/37,
  `prueba-sincro --directa` 13/13, `prueba-sala` 20/20 (con la foto sin pantalla partida). Falta: probarlo con el sitio
  (`jugar.bat`) y una carrera entera hasta la meta con puntos.
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
