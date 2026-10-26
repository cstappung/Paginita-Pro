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

- **2026-10-25 06:30** — **Reasignar todo el mando y el teclado** (§111, con un crítico). Mapa por mando con 20 controles
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
