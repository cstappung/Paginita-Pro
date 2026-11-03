# Pro Kingdoms: plan de la mega actualización «Héroes y Fronteras»

- **Fecha:** 3 de noviembre de 2026.
- **Versión evaluada:** `pk-10`, en modo local.
- **Base:** una partida de prueba de ~1,5 h (Eras I a VI) y la lectura del código de `js/`, `server/` y `functions/`.
- **Para qué sirve:** es la guía para implementar la actualización por partes. Cada fase es una entrega aparte (un PR, una versión `pk-N`). Para pedirla basta con decir «implementa la Fase 0 del plan de Pro Kingdoms».

> **Decisiones del dueño (3 de noviembre de 2026).** Mandan sobre cualquier otra parte de este plan:
> 1. **Se pueden reiniciar los mundos y las partidas** cuando haga falta. Los beta testers saben que pueden perder su reino. No hace falta escribir migraciones ni código de compatibilidad con partidas viejas.
> 2. **Todo se implementa en línea de una vez.** El servidor (Cloud Function) es quien decide en todo lo que toca a otros jugadores. No hay que hacer primero una versión local simulada y después la en línea.
> 3. **Las monedas del reino siguen separadas** de las monedas de Juegos (`monedas.js`).
> 4. **Prestigio («Nueva Dinastía», V10): pendiente.** No se implementa hasta que el dueño lo decida (ver sección 13).

---

## Índice

0. [Resumen](#0-resumen)
1. [Reglas que ninguna fase puede romper](#1-reglas-que-ninguna-fase-puede-romper)
2. [Fase 0: arreglo de bugs](#2-fase-0-arreglo-de-bugs-pk-11)
3. [Fase 1: Automatización 2.0, «El Consejo del Reino»](#3-fase-1-automatización-20-el-consejo-del-reino)
4. [Fase 2: Aventura, «Más allá de la niebla»](#4-fase-2-aventura-más-allá-de-la-niebla)
5. [Fase 3: Entretención y variedad, «Vida en el reino»](#5-fase-3-entretención-y-variedad-vida-en-el-reino)
6. [Fase 4: Combate 2.0](#6-fase-4-combate-20)
7. [Fase 5: Mundo vivo y social](#7-fase-5-mundo-vivo-y-social)
8. [Fase 6: Interfaz, celular y sonido](#8-fase-6-interfaz-celular-y-sonido)
9. [Fase 7: Técnica, pruebas y balance](#9-fase-7-técnica-pruebas-y-balance)
10. [Ritmo objetivo](#10-ritmo-objetivo)
11. [Orden de trabajo y versiones](#11-orden-de-trabajo-y-versiones)
12. [Lista de control de cada entrega](#12-lista-de-control-de-cada-entrega)
13. [Decisiones que debe tomar el dueño](#13-decisiones-que-debe-tomar-el-dueño)
14. [Anexos: tablas de contenido nuevo](#14-anexos-tablas-de-contenido-nuevo)

---

## 0. Resumen

### Dónde estamos

| Aspecto | Nota hoy | Meta | Fase que lo mueve |
|---|---|---|---|
| **Automatización** | 6 | 8,5 | 0, 1 |
| **Entretención** | 6 | 8 | 2, 3, 4 |
| **Aventura** | 5 | 8,5 | 2 |
| Gráficos y ambientación | 8 | 9 | 3, 6 |
| Economía y estrategia | 7 | 8 | 1, 3 |
| Progresión y ritmo | 6 | 8 | 1, 3, 7 |
| Combate | 6 | 8 | 2, 4 |
| Cantidad de contenido | 8 | 9 | 2, 3 |
| Variedad | 5 | 8 | 2, 3, 4 |
| Interfaz y claridad | 6 | 8 | 0, 1, 6 |
| Social y multijugador | 4 | 7 | 5 |
| Celular | 6 | 8 | 6 |
| Estabilidad técnica | 8 | 9 | 0, 7 |
| **Promedio** | **6,2** | **~8,3** | |

### El diagnóstico en tres frases

1. **El arranque es muy bueno, pero desde la Era III el juego se vuelve una planilla.** Casi todo es subir edificios para ganar «+%». Las 15 tecnologías solo suben niveles y las misiones se repiten en escalera.
2. **La aventura se juega desde menús.** El explorador va solo y las mazmorras son una lista con un botón «Piso N». Se encontraron 45 mazmorras de apenas 5 tipos, sin héroes, historia ni jefes con mecánicas.
3. **La automatización se queda a medio camino.** El Capataz solo reparte a los ociosos, las prioridades no mueven a nadie y no hay ayuda para expediciones, investigación ni ventas. Además, dos bugs pueden dejar el pueblo parado (Fase 0).

### Qué trae la actualización

- **Héroes**: 6 clases con niveles, talentos, equipo y habilidades activas en batalla. Lideran expediciones y gobiernan edificios.
- **Mazmorras 2.0**: caminos con elecciones, jefes con mecánicas, modificadores semanales y botín de equipo. Además, 3 mazmorras nuevas con 3 enemigos y 4 tropas nuevas.
- **Viajes visibles** por el mapa, con encuentros donde hay que elegir.
- **Campaña narrativa** de 10 capítulos y **lugares legendarios** en el mapa.
- **El Consejo del Reino**: consejeros que automatizan investigación, expediciones, comercio, obras y exploración. Se desbloquean como progreso.
- **Vida en el reino**: árbol de tecnologías con elecciones, cartas de era, estaciones, ánimo del pueblo, decoraciones con bonos por cercanía y 4 Maravillas a elegir.
- **Combate 2.0**: formación previa, enemigos con roles, asedios por oleadas y torres con ramas.
- **Mundo vivo**: diplomacia con los reinos, rutas comerciales, jefe semanal del gremio y visitas a otros reinos.
- **Interfaz**: menú agrupado, panel «¿Qué hago ahora?», tutorial guiado, barra inferior en el celular y música procedural.

### Tamaño

En total son unas **40 a 55 sesiones** de trabajo de Claude Code, repartidas en **12 entregas** (de `pk-11` a `pk-22`), más la Fase 6, que se puede hacer en paralelo. La Fase 0 cabe en una sesión y conviene hacerla primero, sola.

---

## 1. Reglas que ninguna fase puede romper

Hay que leerlas antes de cada fase. Salen del código y de `juegos/prokingdoms/CLAUDE.md`.

1. **Reiniciar está permitido, pero con orden** (decisión 1 del dueño).
   - Subir `D.SAVE_V` es la forma de reiniciar las partidas. `G.loadSave` (`js/game.js:1175`) descarta la partida local de otra versión, y `main.js` hace lo mismo con la partida en la nube (`net.cloud.v`). Todos empiezan de cero.
   - Para borrar también los mundos del servidor se usa el reinicio por versión de P1 (Fase 0).
   - **Juntar los cambios que rompen:** cuantos menos reinicios, mejor. La sección 11 marca qué entregas reinician y propone agrupar todos los cambios de mapa en una sola.
   - Avisar en el juego: al entrar después de un reinicio, un cartel «El mundo se reinició con la actualización …».
   - Lo nuevo puede seguir entrando con valores por defecto en `G.init` (como `S.ret` o `S.perks`) cuando eso evita un reinicio. Donde este plan habla de «compatibilidad con partidas viejas», es **opcional**.
2. **El mundo compartido se puede cambiar, pero cliente y servidor van juntos.** `D.SEED`, `D.MAPV`, los `amount` de `D.NODES`, `D.ZONES` y `world.js` los usa también el servidor (`server/sim.js` carga `util.js`, `data.js` y `world.js`).
   - Si cambia el mapa, hay que subir `D.MAPV`. El servidor ya reinicia solo los recursos compartidos y los edificios de cada mundo (`sim.js`, líneas 68 a 74).
   - **GitHub Pages publica al hacer merge, pero la Cloud Function se despliega a mano.** Si se desfasan, cliente y servidor ven mapas distintos. Por eso existe la versión de protocolo de P1: el servidor rechaza a un cliente de otra versión con un mensaje claro.
3. **Los lugares nuevos del mapa:** los identificadores de los puntos de interés son su posición en `W.pois`, y las partidas guardan `S.pois` por ese número.
   - En una entrega **con** reinicio (`D.SAVE_V` y `D.MAPV` nuevos), se pueden ubicar libremente.
   - En una entrega **sin** reinicio, van al final y con su propio generador, como las mazmorras (`drng = U.rng(seed + 9091)` en `world.js`). Insertar uno en medio sin reiniciar corre todos los números y corrompe los descubrimientos.
4. **Todo bono nuevo tiene que caber en el antitrampas del servidor**, en la misma entrega (decisión 2: todo en línea). Esto vale para recolección, fuerza del ejército, defensa y producción.
   - En `server/sim.js` están `LIM.slack` (2,5), `kindRate`, `armyMultMax` y `defMax`.
   - Si un bono nuevo (héroes, equipo, ánimo, estaciones, decoraciones) puede pasar ese margen, hay que actualizar `sim.js`.
   - Después hay que correr `node tools/cheat-test.js` y `cd functions && npm run prueba`, y avisar al dueño que **el despliegue es manual** (`firebase deploy --only functions`).
5. **Las monedas del reino siguen separadas de las monedas de Juegos** (decisión 3 del dueño). Nada de este plan llama a `monedas.js`. La tienda cosmética de la Fase 3 usa monedas del reino.
6. **Caché.** En cada entrega hay que:
   - subir el `?v=pk-N` de **todos** los scripts de `index.html` y del CSS;
   - subir `PK_VER` en `colabtex/src/juegos/prokingdoms.js`;
   - correr `cd colabtex && npm run build`.
   - Los archivos nuevos de `js/` también llevan `?v=pk-N` y se agregan a `index.html` en el orden correcto. No hay empaquetador.
7. **Sonido.** La música y los ambientes nuevos pasan por el mismo nodo maestro de `js/sfx.js`, respetan la tecla M y el control de volumen compartido (`volumen.js`, puesto por `sitio.js`). Es una regla de todo el sitio: todo juego ofrece silencio y volumen.
8. **Lo que solo existe en vivo necesita su versión sin conexión.** Los lobos y las incursiones son solo en vivo. Las batallas en vivo tienen `B.adelantar` para el cálculo sin conexión.
   - Toda mecánica nueva que dé o quite recursos tiene que dar el mismo resultado en `G.simulateOffline`, o no existir sin conexión.
   - Las elecciones (encuentros, eventos) sin jugador toman una opción por defecto, con semilla fija.
9. **En la batalla, el balance no va en `vista`.** Los efectos visuales no cambian números. La fuerza sale de `Exp.powerVs`.
10. **Celular.** El panel mide `--ph`, hay como máximo 2 avisos en pantalla y las ventanas van a pantalla completa. Toda ventana nueva se prueba en vertical (390×844) y en horizontal.
11. **Avisos.** Se agregan al principio y se ocultan con `:nth-child(n+K)`. Los que tienen el mismo texto (sin contar números) se agrupan con «×N».
12. **i18n.** Los nombres que escribe la gente (jugadores, reinos, chat, nombres de héroe que el jugador cambie) llevan `translate="no"`. Nunca se compara contra un texto de la interfaz.
13. **Rendimiento.** Un `fillStyle` por figura, no por punto. Con la batalla abierta no se dibuja el mapa. Los sprites se guardan en caché por clave (`BCACHE`).
14. **Documentación.** Cada fase agrega sus decisiones en pocas líneas a `juegos/prokingdoms/CLAUDE.md` (no al `CLAUDE.md` raíz).

---

## 2. Fase 0: arreglo de bugs (`pk-11`)

Se hace primero y sola, porque dos de estos bugs dejan el pueblo parado. Tamaño: **S-M (1 sesión)**.

### B1. El botón «+» de la ventana Aldeanos deja de funcionar después de los lobos

- **Síntoma:** con 159 aldeanos trabajando, «+ Hierro» responde «No tienes aldeanos libres: entrena más en el Centro Urbano». En la prueba, 132 de 159 aldeanos estaban afectados.
- **Causa:** cuando los lobos asustan a un aldeano, `life.js:88` pone `u.scared = 5`. Al pasar el susto, `entities.js` hace `u.scared -= dt` y se queda en un número negativo (por ejemplo −0,03). `A.addJob` (`js/auto.js:263`) filtra con `!u.scared`, y un negativo cuenta como «asustado» para siempre.
- **Arreglo, en dos lugares:**
  ```js
  // js/auto.js, A.addJob
  const vs = A.villagers().filter(u => !(u.scared > 0)), c = A.jobCounts();
  // js/entities.js, update(): al terminar el susto, dejarlo en cero
  if (u.scared <= 0) { u.scared = 0; u.path = []; u.fails = 0; return; }
  ```
  Y al cargar una partida, normalizar `scared` negativos a 0.
- **Prueba:** invocar lobos (panel `?dev` → «Lobos»), esperar a que se vayan y pulsar «+» en cualquier trabajo. Tiene que mover a un aldeano.

### B2. El Centro Urbano puede quedar encerrado por edificios

- **Síntoma:** con muchas casas alrededor, el Centro Urbano queda en un patio cerrado. Los aldeanos nacen adentro y no llegan a ningún recurso. En la prueba hubo 93 de 154 aldeanos parados.
  - El aviso dice «no queda madera a su alcance: explora más lejos», y es falso: había 358 árboles alcanzables desde afuera.
  - Demoler 3 casas lo arregló al instante.
- **Causa:**
  - `G.placeWhy` (`js/game.js:794`) no revisa si un edificio cierra el paso.
  - `homeRegions` (`js/entities.js:403`) toma como «casa» toda región de 30 casillas o más pegada al Centro Urbano, y el patio cerrado cumple eso. Por eso el rescate de `unstick` nunca se activa.
  - `idleHint` (`js/auto.js`) solo sabe decir «explora».
- **Arreglo, en tres capas:**
  1. **Prevenir.** Una nueva razón `'encierra'` en `G.placeWhy`:
     - Hay que simular el bloqueo de la huella del edificio y comprobar que el borde del Centro Urbano sigue conectado a la región grande (la que toca el borde del mapa, o la mayor del reino).
     - Sirve un relleno por inundación acotado (BFS desde el borde del Centro Urbano con tope de, por ejemplo, 3.000 casillas).
     - Calcularlo solo al confirmar y como mucho cada 150 ms mientras se mueve el fantasma.
     - Texto: «Así encerrarías a tu pueblo: deja al menos una casilla de paso».
     - Vale también para `G.moveBuilding`, que usa `placeWhy`.
  2. **Detectar y explicar.**
     - En `homeRegions`, preferir la región adyacente más grande. Si todas son chicas (menos de ~600 casillas) y sin recursos alcanzables, marcar `S.flags.encerrado`.
     - Mostrar un cartel: «Tu Centro Urbano quedó encerrado por edificios. Mueve o demuele uno de los marcados».
     - Resaltar los edificios que tocan a la vez el patio y el exterior. Son exactamente los que liberan el paso.
     - Con ese aviso, `idleHint` deja de recomendar explorar.
  3. **Nunca trabar el juego.**
     - `G.spawnUnit` hace nacer al aldeano en la casilla libre más cercana **de la región grande** («sale por la puerta de atrás») si la del Centro Urbano está encerrada.
     - `unstick` rescata hacia esa región.
- **Prueba:** rodear el Centro Urbano de casas en `?dev`. La última casa que cierra el paso tiene que ser rechazada. Si se fuerza el cierre con una partida guardada armada a mano, aparece el cartel y los aldeanos nuevos salen afuera.
- **Prueba automática:** `world.js` corre en Node (lo usa el servidor), así que se puede probar con un mapa sintético (ver T3).

### B3. Misión imposible: «Al bosque común» (`e3`) bloquea otras dos

- **Síntoma:** la misión pide «300 de madera en el Bosque Ancestral, la gran zona común del centro del mapa», pero ese lugar no existe y la misión nunca se cumple. Detrás de ella quedan bloqueadas «Bien común» (`e11`) y «Fiesta en el pueblo» (`e12`).
- **Causa:**
  - `data.js:765` exige la estadística `z_forest`.
  - `gained()` (`js/game.js:324`) cuenta `z_<id de zona>`, y los ids son `z0`, `z1`…
  - Las zonas de bosque se llaman «Bosque del Cuervo», «Bosque de Hierro», etc. No hay ninguna central llamada «Ancestral».
- **Arreglo:**
  - En `gained()`, contar también por tipo: `G.stat('z_' + z.type, n)`, es decir `z_tree`.
  - La misión pasa a pedir `z_tree` con este texto: «Recolecta 300 de madera en un bosque común (una zona compartida con tus vecinos; primero tienes que descubrirla)».
  - (Opcional si la entrega reinicia) En `Quests.init`, completar `S.stats.z_tree` sumando los `z_<id>` de las zonas de bosque, para que no pierda progreso quien ya taló ahí.
  - Cambiar la frase del chat «El Bosque Ancestral rebrota lento…» (`data.js:521`) por un bosque que exista.
- **Prueba:** la prueba automática T3 recorre todas las misiones y falla si alguna pide una estadística que nadie registra. Con esa prueba, este bug se habría visto antes de publicar.

### B4. La reserva de los talleres los apaga sin explicar por qué

- **Síntoma:** la Fundición dice «Sin trabajadores» y nadie entra, aunque hay 1.650 de hierro.
- **Causa:** la «Reserva de los talleres» viene en 30% por defecto. Con un tope de 9.396, el taller no toma hierro mientras haya menos de 2.819. `openShop` (`js/auto.js`) se salta el taller sin dejar un estado legible.
- **Arreglo:**
  - Agregar un estado propio: «En reserva: falta hierro bruto (tienes 1.650; la reserva guarda 2.819)». Se ve en el panel del edificio, en Logística y en el panel Asesor (A6).
  - Agregar un botón «Producir igual» por taller (`b.sinReserva = true`) que ignore la reserva solo para ese taller.
  - Bajar el valor por defecto a 15% **solo en partidas nuevas**, sin tocar la elección de quien ya lo cambió.
- **Prueba:** con hierro bajo la reserva, el panel muestra la razón y «Producir igual» lo pone a trabajar.

### B5. Cambiar las prioridades del Capataz no hace nada si nadie está ocioso

- **Síntoma:** con la población al máximo, subir «Piedra» en Prioridades no mueve a nadie. En la prueba hubo 137 aldeanos en madera, 0 en piedra y 0 en hierro, con la madera llena.
- **Causa:** `assignIdle` solo reparte aldeanos sin tarea. Nadie reequilibra a los que ya trabajan.
- **Arreglo mínimo para la Fase 0:**
  - Al cambiar una prioridad, hacer una pasada que mueva hasta 10 aldeanos **que puso el Capataz** (nunca uno con `task.m`) desde los trabajos sobre su objetivo hacia los que están por debajo.
  - Los recursos con la bodega llena cuentan como «sobre el objetivo».
  - El reequilibrio continuo es A1.
- **Prueba:** con todos ocupados, subir una prioridad mueve gente en menos de 2 s, y las órdenes manuales (`task.m`) no se tocan.

### B6. `?timelapse` carga un archivo que no existe

- **Causa:** `js/main.js:48` agrega `tools/timelapse.js`, pero `tools/` solo tiene `cheat-test.js`.
- **Arreglo:** recuperar la herramienta si el dueño la tiene, o reemplazarla por el piloto de pruebas T1 (`tools/piloto.js`). Mientras tanto, mostrar en la pantalla de carga «Herramienta de time-lapse no incluida» en vez de quedarse sin bucle.

### B7. El texto al pasar el mouse no se actualiza

- **Síntoma:** después de mover la cámara (o de que suba de nivel lo que estaba debajo), el cartel sigue mostrando «Centro Urbano · Nv 2» aunque el Centro ya es nivel 10.
- **Causa:** `UI.hoverInfo` solo se llama en `pointermove` (`js/input.js:106`).
- **Arreglo:** en `PK.Input.update`, si el puntero está sobre el lienzo, recalcular `r.hover` con la última posición cada 250 ms y al mover la cámara (WASD, rueda, arrastre, `centerOn`).

### B8. En la ventana del Capataz, las casillas quedan lejos de su texto

- **Causa:** la regla `.modal-body input` les da 90 px de ancho a las casillas.
- **Arreglo:** agregar en `css/style.css`:
  ```css
  .modal-body input[type=checkbox], .modal-body input[type=radio] { width: auto; padding: 0; }
  ```

### P1. Herramientas para reiniciar y para desplegar sin desfase

No son bugs, pero hacen falta antes de cualquier cambio que rompa (decisiones 1 y 2 del dueño).

- **Reinicio por versión del mundo.** Una constante nueva `D.MUNDO_VER` en `js/data.js`.
  - En `functions/store-rtdb.js`, `carga()` lee `prokingdoms/mundoVer`. Si no coincide, borra `prokingdoms/col`, `prokingdoms/partidas` y `prokingdoms/hayPartida`, y escribe la versión nueva. Lo mismo en `server/store.js` (servidor local, carpeta `server/data/`).
  - Así, reiniciar es: subir `D.MUNDO_VER` (y `D.SAVE_V`) y desplegar. Sin tocar la consola de Firebase.
  - Hay que borrar **antes** de que la instancia nueva acepte pedidos, y no tocar `prokingdoms/sospechas`.
- **Versión de protocolo.** Una constante `D.PROTO` que el cliente manda en `POST /api/join`.
  - Si no coincide con la del servidor, `join` responde un error propio («El servidor se está actualizando»).
  - El cliente muestra ese mensaje en la pantalla de carga con un botón «Jugar sin conexión», en vez de entrar a un mundo con otro mapa.
- **Cartel de reinicio.** Si hay datos de una partida vieja (otra `v`) en `localStorage`, mostrar una vez: «El mundo se reinició con la actualización …» con un resumen de novedades.
- **Prueba:** con los emuladores, subir `D.MUNDO_VER` y comprobar que el mundo queda vacío. Con un cliente de otro `D.PROTO`, comprobar el mensaje.

### Cierre de la Fase 0

- Crear la prueba automática `colabtex/tests/prokingdoms.test.cjs` (T3) y agregarla a `test:juegos`.
- Anotar B1 a B5 en `juegos/prokingdoms/CLAUDE.md`, en pocas líneas.
- Subir a `pk-11`.

---

## 3. Fase 1: Automatización 2.0, «El Consejo del Reino»

Objetivo: que el reino **se maneje solo si el jugador quiere**, y que esa comodidad sea **progreso que se desbloquea**, no un regalo del principio. Tamaño: **L (5-7 sesiones)**, `pk-13` y `pk-14`.

### A1. Capataz que reequilibra (`js/auto.js`)

- Cada 20 s de juego, mover hasta 3 aldeanos puestos por el Capataz hacia el trabajo más lejos de su objetivo.
- Hay que evitar el ir y venir:
  - mover solo si la diferencia supera el 8% de la población;
  - mover primero al que acaba de descargar (`carry` en 0).
- Un recurso con la bodega llena (`G.isFull`) o con todos sus nodos ocupados (`G.nodeRoom`) cuenta como satisfecho.
- Nueva casilla «Reequilibrar», encendida por defecto. Con ella apagada, todo funciona como hoy.
- También funciona sin conexión: `simulateOffline` reparte por tasas con los mismos objetivos.

### A2. Planes de prioridades

- **Planes listos:** Equilibrado, Construcción (madera y piedra), Industria (hierro, mármol y talleres), Guerra (comida y oro), Tesoro (oro y gemas).
- **Modo «Meta de era»:** calcula cuánto falta de `D.eraCost(era + 1)` y de la cola de obras, y fija los objetivos para cerrar esa brecha. Se recalcula cada minuto.
- Se guardan en `S.auto.plan`. El modo manual de hoy pasa a llamarse «A mano».

### A3. Edificio nuevo: Salón del Consejo (Era II, uno solo)

Cada nivel desbloquea un consejero. Cada consejero se activa o desactiva por separado y anota lo que hizo en el informe «Mientras no estabas».

| Nivel | Consejero | Qué hace solo |
|---|---|---|
| 1 | **Mayordomo** | Cola de investigación de hasta 5 técnicas. Reclama misiones, diarias y semanales (opcional). Abre cofres. |
| 2 | **Cartógrafo** | Mueve al explorador hacia las zonas sin descubrir que el jugador marque (A4) o hacia la más cercana con niebla, y avisa cada lugar nuevo. |
| 3 | **Mariscal** | Recluta hasta una guarnición objetivo. Repite pisos ya limpiados cuando la mazmorra se repuso, con un umbral de probabilidad elegible (por defecto 85%), para juntar recursos especiales. Acepta encargos del tablón que estén por debajo de tu fuerza. Nunca deja la defensa del reino bajo un mínimo. |
| 5 | **Tesorero** | Vende lo que pase del X% del tope (por defecto 90%) y compra lo que falta para la meta de era. Respeta una reserva de oro. Usa los mismos límites diarios que el servidor (`LIM.marketDay`). |
| 7 | **Maestro mayor** | Reglas de obras: «casas siempre al máximo de la era», «sube el almacén cuando la bodega pase del 80%», «talleres antes que casas». Llena la cola de obras con esas reglas. |
| 9 | **Gobernador** | Organiza una fiesta del pueblo o paga horas extra cuando sobra mucho (por encima del 95% del tope), usando las reglas que ya existen (`G.fiesta`, `G.overtime`). |

- El Salón se dibuja con un `BDRAW.consejo` nuevo en `sprites.js`. Lleva estadísticas en `D.BSTATS` y textos en `D.STAT_LABELS`.
- Misiones nuevas en la rama Obras: «El primer consejero», «Un consejo completo».

### A4. Exploración dirigida

- Tocar el minimapa o el mapa con la herramienta «Explorar aquí» pone una bandera de exploración. El explorador (o el Cartógrafo) va hacia allá antes que a la niebla más cercana (`G.exploreTarget`).
- Hasta 3 banderas. Se ven en el minimapa.
- Una tecnología o el Puesto de Exploradores en nivel 5 permite un segundo explorador dirigido.

### A5. Puestos avanzados guiados

Cuando un recurso con prioridad no tiene nodos vivos alcanzables a menos de 20 casillas, aparece un aviso:

- «Se acabó la piedra cerca. Hay una cantera a 33 casillas: ¿construir un Campamento Minero allí?».
- El botón deja el fantasma ya ubicado. Usa la regla de puestos de `G.OUTPOST`, que ya permite construir en tierra de nadie.

En el panel de cada recurso, un indicador de **eficiencia**: el porcentaje del tiempo que los aldeanos caminan en vez de recolectar. Si pasa del 50%: «Pon un punto de acopio más cerca».

### A6. Panel Asesor: «¿Qué me frena?»

Un botón fijo junto a la era. Muestra los 3 problemas más importantes, cada uno con un botón que lo arregla:

- «La Fundición está parada: falta hierro (reserva 30%)» → **Producir igual** o **Bajar reserva**.
- «0 aldeanos en piedra y la meta de era pide 1.500» → **Mandar 10**.
- «Tu Centro Urbano está encerrado» (B2) → **Ver edificios**.
- «Bodega de oro llena» → **Vender 1.000** o **Fiesta**.
- «Tu explorador terminó su alcance» → **Mejorar Puesto**.
- «2 maestros de obras libres» → **Elegir obra**.

Detrás va una lista ordenada de reglas en un archivo nuevo, `js/asesor.js` (`PK.Asesor.problemas()` devuelve `[{prioridad, texto, accion}]`). El mismo motor alimenta el aviso al volver y la Fase 6 (U2).

### A7. Barrios: construir en cuadrícula sin encerrarse

- Al poner varias casas con Mayús, el modo «barrio» las ubica en una cuadrícula que deja calles de 1 casilla.
- Puede trazar caminos solo (`PK.Logi.buildRoad`) si alcanza la piedra.
- Junto con B2, esto evita el encierro que se produjo en la prueba.

### Criterios de aceptación de la Fase 1

- Con todo automático encendido y el jugador ausente 12 horas, el reino avanza de era cuando le alcanza. El informe lista lo que hizo cada consejero.
- Una partida del piloto (T1) sin intervención llega a la Era IV en menos tiempo que hoy, sin aldeanos ociosos más de 60 s seguidos.
- Ninguna acción automática pasa los límites diarios del servidor.

---

## 4. Fase 2: Aventura, «Más allá de la niebla»

Es el corazón de la actualización. Tamaño: **XL (14-18 sesiones)**, de `pk-15` a `pk-18`, más `pk-21` para las mazmorras nuevas.

### H1. Héroes (sistema nuevo: `js/heroes.js`, `PK.Heroes`)

**Modelo**, guardado en `S.heroes`:

```js
{ id, clase, nombre, nivel, xp, talentos: [..], equipo: { arma, armadura, talisman },
  estado: 'libre' | 'expedicion' | 'gobierna' | 'explora' | 'herido', hasta, gobierna: bid, rasgo }
```

- **Reclutamiento en la Taberna.** La Taberna se desbloquea en cuanto se construye el Cuartel (Era II), sin tener que reclamar la misión `l1`.
  - Cada día real hay 3 candidatos con clase, rasgo y nivel inicial distintos.
  - Cuestan oro y un recurso especial.
  - Máximo de héroes: 1 + nivel de la Taberna / 2, hasta 6.
- **Clases:** 6 clases (tabla en el Anexo A1). Cada una tiene:
  - una **pasiva de reino** mientras gobierna un edificio;
  - una **habilidad activa** en batalla, con recarga;
  - un tipo de enemigo contra el que rinde más.
- **Niveles:**
  - La experiencia sale de expediciones, encargos, viajes y jefes.
  - El tope es 5 + 3 × era, hasta 40.
  - Cada 5 niveles se elige 1 de 2 talentos, en 8 escalones.
- **Equipo:**
  - Tres espacios: arma, armadura y talismán.
  - Cuatro rarezas: común, rara, épica y legendaria.
  - Los objetos se generan con semilla: tipo, rareza, 1 a 3 atributos, por ejemplo «+12% fuerza», «+20% contra no-muertos», «−10% bajas» o «+5% recolección del edificio que gobierna».
  - Salen de mazmorras, jefes, mapas del tesoro y encuentros.
  - Se pueden **fundir** para sacar «Esencia», con la que se mejoran objetos.
- **Herido, nunca muerto.** Si su grupo pierde, el héroe queda herido de 30 min a 2 h reales. El Monasterio acorta ese tiempo según su nivel. Así no hay frustración.
- **Retratos:** se generan por código, como todo el arte (`Sp.retrato(clase, semilla)`): cara, pelo, casco y fondo con el color de la clase.
- **Servidor:** los héroes viven en el cliente, pero suben la fuerza del ejército.
  - Hay que medir el multiplicador máximo con héroe y equipo legendario, sumarlo a `armyMultMax` en `server/sim.js` y correr el cheat-test.
  - Tope recomendado: héroe + equipo ≤ +60% sobre la compañía.
- **Interfaz:** un botón «Héroes» en el menú. La ventana tiene una lista, una ficha (retrato, atributos, talentos, equipo) y un inventario.

### H2. Viajes visibles y encuentros en el camino

- Las expediciones con un héroe se **ven en el mapa**: el grupo camina por la ruta A* que ya calcula `js/troops.js`.
- Cada cierta distancia hay un **encuentro**: una carta con 2 o 3 opciones, cada una con riesgo y premio. Ejemplos en el Anexo A5; se proponen 30 cartas por bioma y era.
- Sin el jugador (sin conexión o sin mirar), se toma la opción cauta con semilla `(id de viaje, número de encuentro)`. Así el resultado es el mismo en vivo y sin conexión (regla 8).
- Las cartas viven en `D.ENCUENTROS`, en `js/data.js` o en un archivo nuevo `js/datos-aventura.js` para no inflar `data.js`.

### H3. Mazmorras 2.0

Hoy cada piso es «botón → esperar → batalla». La propuesta es convertir cada visita en una **incursión de 5 pisos con caminos**:

1. **Mapa de la incursión.** En cada piso se elige entre 2 o 3 salas. Los tipos de sala son:
   - **Combate**;
   - **Élite**: más difícil, con botín de equipo;
   - **Tesoro**: sin pelea;
   - **Trampa**: se pierde un poco de vida, a menos que haya un Guardabosques;
   - **Santuario**: cura o da una bendición para la incursión;
   - **Mercader**: cambia recursos especiales por equipo;
   - **Misterio**: un encuentro de H2.
2. **Estado guardado** por mazmorra en `S.exp.sites[id].run`: piso, vida restante de cada grupo, bendiciones.
   - Se puede retirar entre salas y quedarse con lo ganado.
   - Si pierde, se lleva la mitad.
3. **Jefes cada 5 pisos**, uno por tipo de mazmorra, con mecánicas reales en `js/batalla.js` (Anexo A2). Son el momento «épico» que hoy falta.
4. **Modificadores semanales («afijos»).** Cada lunes, 2 afijos para todas las mazmorras; la clave es la semana (`weekKey` de quests). Ejemplos en el Anexo A3. Suben la dificultad y el botín.
5. Los **recursos especiales** siguen saliendo como hoy, para que las Leyendas sigan funcionando. A eso se suman equipo y trofeos de jefe (sección nueva del Álbum: «Trofeos»).
6. `site.best` sigue contando el piso máximo, y la incursión empieza en el bloque de 5 pisos que toca. (La compatibilidad con partidas viejas es opcional: ver regla 1.)

### H4. Mazmorras, enemigos y tropas nuevas (`pk-21`)

Cambian el mapa, así que conviene ubicarlas en la **misma entrega que los lugares legendarios (H6)**, con un solo reinicio (regla 3 y sección 11).

| Mazmorra | Era | Enemigo nuevo | Recurso especial | Estructura de Leyenda que desbloquea |
|---|---|---|---|---|
| Pantano de las Brujas | III | **Arcanos**: brujas que maldicen (−velocidad) y fuegos fatuos | Hierbas raras | **Herbolario**: −30% tiempo de heridas, pociones para incursiones |
| Fortaleza de los Gigantes | VI | **Gigantes**: golpe en área, lentos, mucha vida | Hueso de titán | **Forja de Titanes**: equipo de héroe +1 rareza al mejorar |
| Templo Hundido (junto a lagos) | VIII | **Abisales**: tentáculos que agarran, sirenas que encantan | Perlas abisales | **Faro Abisal**: +visión enorme y rutas comerciales más seguras |

Tropas nuevas en `D.ARMY` y `TROPA` de `batalla.js`, con sus sprites en `S.troop`:

| Tropa | Era | Rol | Contra qué rinde |
|---|---|---|---|
| Jinete | III | Rápido, flanquea | ×1,5 contra arcanos, ×1,3 contra bandidos |
| Ballestero | IV | Tirador pesado y lento | ×2 contra gigantes, ×1,3 contra gólems |
| Monje guerrero | V | Pelea y cura poco | ×1,5 contra arcanos, ×1,5 contra no-muertos |
| Mago de batalla | VI | Daño en área a distancia | ×2 contra abisales, ×1,4 contra gólems |

- Hay que agregar los consejos nuevos en `B.CONSEJO` y los textos de rol.
- Con 8 tipos de enemigo y 10 tropas, la matriz de ventajas tiene que dejar **al menos 2 respuestas buenas por enemigo**. La prueba T3 lo comprueba.

### H5. Campaña narrativa: «La Crónica del Reino»

La rama Crónica hoy son metas de población y de era. Se le agrega **un capítulo por era**, de la II a la XI:

- Una escena de diálogo con retratos (los mismos de H1) y 2 o 3 líneas.
- De 3 a 5 misiones con texto propio, mezclando construcción, exploración y combate.
- **Un lugar único en el mapa** que aparece al empezar el capítulo y **una batalla final con jefe**.
- **Una elección** que cambia el premio. Por ejemplo, perdonar al Rey Bandido lo convierte en héroe; vencerlo da su tesoro.

Personajes que vuelven: **el Forastero de la Capa** (ya está en la misión `l1`, así que pasa a ser el narrador), **Brunilda** (la reina rival vecina de la casilla 1), **el Rey Bandido**, **la Orden del Cráter** y **Ignivor el Antiguo**. Guion de los 10 capítulos en el Anexo A4.

- Las misiones nuevas van en `D.QUESTS` con prerrequisitos en `pre`, como las de hoy.
- Las escenas van en `D.ESCENAS`, y `UI.escena(id)` dibuja una ventana con retrato y texto.

### H6. Lugares legendarios del mapa

- 12 maravillas naturales (Anexo A6) en una capa nueva de POI (regla 3).
- Se descubren explorando. Para activarlas hace falta **mandar a un héroe a investigarlas**, que tarda un rato y a veces trae un encuentro.
- Dan un bono permanente pequeño, una página de historia y una entrada en el Álbum («Maravillas del mundo»).

### H7. Mapas del tesoro

- Las ruinas y algunos encuentros dan un **mapa del tesoro** que marca una casilla en la niebla, con una pista visual en el minimapa.
- Un héroe o el explorador va a desenterrarlo y encuentra un cofre con equipo garantizado (raro o mejor).
- Se guardan en `S.mapas`, y se generan con semilla desde la ruina para que no se puedan repetir.

### H8. Eventos con decisiones

Los eventos de `js/life.js` pasan a admitir **opciones** además del botón único:

- `action` se convierte en `opciones: [{label, run}]`.
- Sin respuesta en `dur`, se aplica la opción por defecto.
- Se suman 20 eventos nuevos (Anexo A7).

Usan sprites que ya existen. Por ejemplo, el **balde** (`S.bucket`) sirve para el incendio, donde los aldeanos acuden a apagar el fuego.

### Criterios de aceptación de la Fase 2

- Un jugador de la Era II tiene **al menos una decisión con consecuencias cada 10 minutos**: un encuentro, un evento con opciones, un camino de incursión o un talento.
- Los jefes se pueden ganar con la compañía y las órdenes correctas, y se pierden ignorando la mecánica. Se mide con `B.adelantar` en 200 peleas por jefe.
- Si la entrega no reinicia, las partidas anteriores cargan sin perder nada. Si reinicia, se subieron `D.SAVE_V`, `D.MAPV` y `D.MUNDO_VER`, y aparece el cartel de reinicio.

---

## 5. Fase 3: Entretención y variedad, «Vida en el reino»

Tamaño: **L-XL (6-8 sesiones)**, `pk-19` y `pk-20`.

### V1. Árbol de tecnologías 2.0

- Las 15 técnicas de hoy se quedan como **«Fundamentos»** (niveles de +%), para que las partidas guardadas conserven sus valores.
- Se agrega un **árbol de 4 ramas**: Economía, Industria, Guerra y Saber. Tiene unos 32 nodos que **desbloquean cosas**, no solo porcentajes (Anexo A8).
- **Elecciones exclusivas:** en cada era, dos nodos enfrentados (por ejemplo «Rotación de cultivos» o «Graneros comunitarios»). Elegir uno bloquea el otro hasta la siguiente era.
- Se guarda en `S.arbol = { nodo: true }`. La Biblioteca sigue fijando el ritmo y la Universidad lo acelera.

### V2. Cartas de era

- Al llegar a cada era, se elige **1 de 3 cartas** de un mazo de unas 30 (Anexo A9). Algunas tienen una contra, por ejemplo «Fiebre del oro: +30% oro, −10% comida».
- Los decretos de las Eras VII y X (`D.DECREES`) quedan como cartas «reales» especiales.
- Las cartas se ven en el panel del reino y suman una sección al Álbum.

### V3. Estaciones y día/noche

- Las estaciones salen del reloj real: `Math.floor(Date.now() / DUR) % 4`, con una estación cada 6 h reales. Así son iguales en vivo, sin conexión y en el servidor.
- **Efectos suaves**, siempre dentro de `LIM.slack`:
  - primavera: +15% granjas y bayas;
  - verano: +10% recolección;
  - otoño: +20% caza y madera;
  - invierno: −20% granjas y +20% minería («se trabaja bajo techo»).
- **Visual:** pasto que cambia de tono, hojas en otoño y nieve en invierno, con un recolor del suelo en `renderGroundChunk`, en caché por estación.
  - De noche (hora real del jugador), luces en las ventanas.
  - Opción para apagar la noche.
- **Eventos de temporada:** Feria de primavera, Torneo de verano, Cosecha de otoño, Festival de invierno.
- No se agrega consumo obligatorio de comida (ver Decisiones), para no castigar al que se va 12 horas.

### V4. Ánimo del pueblo

- Un valor de 0 a 100 visible en la barra superior, junto a la población.
- **Sube con:** decoraciones (V5), Taberna, fiestas, variedad de edificios cerca de las casas, defensas ganadas y héroes Juglar.
- **Baja con:** incursiones perdidas, bodegas vacías de comida, eventos malos y casas lejos de un punto de acopio.
- **Efecto:** de −10% a +15% de recolección y producción. Lo que se pasa de 80 da un evento «Día feliz».
- Lo calcula `G.animo()` cada 10 s. Sin conexión se usa el valor promedio. Hay que sumarlo al margen del servidor.

### V5. Decoraciones y bonos por cercanía

- **15 decoraciones** de 1×1 o 2×2, como estatua, fuente, farol, jardín o plaza (Anexo A10).
  - Se compran con recursos o con monedas del reino.
  - Dan ánimo en un radio.
- **Bonos por cercanía:** se ven al ubicar el fantasma, con líneas verdes hacia los vecinos que suman. Por ejemplo:
  - Granja junto a Molino: +10% comida.
  - Aserradero junto a Campamento Maderero: +10% tablones.
  - Herrería junto a Fundición: las carretas sobran entre ellas, se pasan los lingotes directo.
  - Casa junto a una Plaza o Fuente: +1 población.
  - Biblioteca junto a Universidad: +5% investigación.
- Se definen en `D.CERCANIA = [{a, b, radio, efecto}]` y se calculan al construir, mover o demoler, con `capsDirty`.

### V6. Maravillas 2.0

- En la Era VI se elige **1 de 4 Maravillas**:
  - **Gran Faro**: comercio y visión;
  - **Coloso**: ejército;
  - **Jardines Eternos**: recolección y ánimo;
  - **Gran Catedral**: investigación y reliquias.
- Cada una tiene un sprite propio **más grande (5×5)**, con **etapas visibles** de construcción cada 5 niveles: andamios, cúpula, estatua, brillos.
- La Maravilla de hoy (4×4) se reemplaza por estas cuatro. Sin reinicio, quien ya la tenga puede «transformarla» gratis en una de las cuatro, conservando su nivel.

### V7. Misiones con más sabor y desafíos

- Las escaleras repetitivas (Constructor Incansable I–VIII, Atlas I–VI, etc.) se **acortan**: hasta 4 rangos visibles por escalera. Cada rango da un **título** y un **cosmético** (estandarte, color de techo).
- **40 desafíos** con condiciones, como «Gana un combate usando solo arqueros», «Defiende 3 incursiones sin perder recursos», «Llega a la Era III con menos de 40 aldeanos» o «Haz 3 fiestas en un día».
- **Retos del Rey:** 3 desafíos por semana que se renuevan el lunes, con un cofre real de premio.

### V8. Tienda del reino (monedas del reino)

- Solo cosméticos y comodidades que no rompen el balance:
  - colores de techo, estandartes, diseños del Centro Urbano, marcos de retrato de héroe, fuegos artificiales para festejar una era;
  - espacios extra en la cola de investigación.
- Los aceleradores que ya existen (`speedup`, reparar racha) se quedan como están.
- No tocan `monedas.js` (regla 5).

### V9. Muelle de pesca

- Un edificio nuevo de la Era II que va **pegado al agua**. Rinde comida según las casillas de agua a su alrededor, sin crear nodos en el mapa (regla 2).
- Con un barquito animado.
- Abre una alternativa a las granjas y hace que los lagos sirvan para algo.

### V10. Prestigio «Nueva Dinastía» (pendiente de decisión del dueño: no implementar todavía)

**Qué es:** el reino se vuelve a fundar desde cero a cambio de bonos permanentes, que hacen la siguiente partida más rápida. Es el «ascender» de los juegos idle (Cookie Clicker, AdVenture Capitalist, Clicker Heroes). Es voluntario: nadie está obligado.


- Desde la Era X se puede **fundar una nueva dinastía**: el reino vuelve a la Era I y se conservan los héroes, los cosméticos, el Álbum y la Crónica.
- Se ganan **puntos de Legado** según la era y la Maravilla, que se gastan en un árbol permanente: +recolección, eras más rápidas, un héroe extra.
- **Servidor:** la era baja. Hay que confirmar que `sim.js` acepta una era menor y que `vera` no bloquea volver a subir (`LIM.eraGap`). Se activa solo con el visto bueno del dueño.

### Criterios de aceptación de la Fase 3

- Dos partidas con elecciones distintas (árbol, cartas, Maravilla) **se ven y se juegan distinto** a la misma hora de juego.
- El ánimo y las estaciones no pasan el margen del servidor (cheat-test en verde).

---

## 6. Fase 4: Combate 2.0

Tamaño: **L (4-5 sesiones)**, `pk-21`, junto con H4.

### C1. Preparación antes de pelear

- Antes de empezar, una pantalla de **formación**: arrastrar cada grupo a una de 3 filas (frente, medio, atrás) y elegir el flanco del héroe.
- Formaciones que se guardan (`S.formaciones`), con la última usada por defecto.
- **Terreno** según el lugar: rocas que cubren a los tiradores, un puente que obliga a pasar de a pocos, una loma que da +alcance.
- El terreno viene de `escenarios.js`, que ya dibuja el lugar. Se agrega `esc.obstaculos`, que la simulación usa para el movimiento.

### C2. Héroes en batalla

- Retrato del héroe en la barra inferior, con su habilidad activa y la recarga a la vista. Es **un botón, y en el celular un toque**.
- Si el jugador no mira, la habilidad se usa sola con la mejor regla («cuando haya 3 o más enemigos juntos»), para que `B.adelantar` dé el mismo resultado.

### C3. Leer bien la pelea

- **Escala automática:** el campo hace zoom para que las figuras no sean puntos. Con pocos grupos se ven más grandes.
- **Sprites nuevos** para el gólem (cuerpo con brazos y cristales, no una roca), el oso y el jefe de bandidos.
- Números de daño más claros y una barra de vida grande para los jefes.
- **Pausa táctica** (barra espaciadora o un botón) para dar órdenes, además de ×2 y ×4.

### C4. Enemigos con roles

- **Chamán** (cura a los suyos), **escudero** (para flechas de frente), **jefe de banda** (aura de +daño), **invocador** (llama refuerzos) y **élite** (con nombre y más vida).
- Las órdenes de hoy (`linea`, `dispersar`, `foco`) ganan sentido: «enfocar al chamán» pasa a ser una decisión real.

### C5. Defensa 2.0: asedios y torres

- **Asedios por oleadas** (Era III en adelante, solo en vivo, como las incursiones): 3 oleadas con 30 s entre una y otra. Las torres y los soldados defienden, y los aldeanos se refugian en el Centro Urbano.
  - Sin conexión, el asedio no ocurre. Mantiene la regla de `incursiones.js`.
- **Ramas de torre:** al llegar a nivel 5, se elige Arquera (rápida), Balista (daño alto), Aceite (área junto a las murallas) o Mística (ralentiza).
- **Trampas** de pinchos y brea, que se ponen como murallas en tu territorio.

### C6. Rivales con ejércitos visibles

- Desde la Era IV, los reinos que maneja el servidor (los bots de `sim.js`, que ya tienen ataques) mandan **partidas de saqueo** que se ven marchar por el mapa, con aviso previo. El servidor decide el ataque y el resultado, y el cliente lo dibuja.
- Opciones: **pagar tributo**, **pelear** o **pedir ayuda a un aliado** (S1).
- Los reinos con personalidad «Conquistador» lo hacen más seguido.

### C7. Informe de batalla mejorado

- Muestra al grupo más valioso, el daño por tipo de tropa, las bajas y una frase de consejo (`B.CONSEJO`).
- Botón «Repetir con la misma compañía».

### C8. Veteranía a la vista

- Estrellas sobre las figuras según el rango (`D.RANKS`) y estandartes por rango en la guarnición del Cuartel.

---

## 7. Fase 5: Mundo vivo y social

Tamaño: **L-XL (6-8 sesiones)**, `pk-22` y siguientes. Todo se hace **directamente en línea** (decisión 2 del dueño):

- El servidor (`server/sim.js` y `server/index.js`, desplegados como Cloud Function) guarda el estado y valida cada acción, con límites diarios en `LIM`.
- Los reinos que no son de jugadores ya los simula el servidor (los «bots» de cada mundo en `sim.js`), así que su diplomacia y sus ejércitos también corren allí.
- Si el servidor no responde y el juego cae en modo local, estas funciones muestran «Requiere conexión» en vez de simularse en el navegador.

### S1. Diplomacia con los reinos

- Cada reino tiene una relación de −100 a +100 y una **personalidad**: Comerciante, Conquistador, Sabio o Ermitaño. Se elige con semilla según la casilla de `D.REALM_SLOTS`.
- **Acciones:**
  - regalo;
  - tratado de comercio (−10% en los precios entre ambos);
  - pacto de no agresión;
  - alianza (te ayudan en asedios y te mandan tropas);
  - declarar rivalidad.
- **Eventos diplomáticos:** bodas reales, embajadas, ultimátum, pedidos de ayuda.
- La ventana Reinos pasa a ser una **ficha por reino** con escudo, personalidad, relación y acciones, en vez de una lista.
- **Rutas nuevas** en `server/index.js` y `sim.js` (`diplo/propose`, `diplo/accept`, `diplo/gift`), con límites diarios en `LIM`. El servidor responde por los bots según su personalidad. Las reglas de conquista de `D.canConquer` respetan los pactos.

### S2. Rutas comerciales

- Una **caravana visible** va de tu reino a otro con quien tengas tratado y da oro por viaje. La caravana usa el sprite de carreta (`S.cart`).
- Riesgo de bandidos según la ruta, que baja con escolta o con el Faro Abisal.

### S3. Jefe semanal del gremio

- «El Leviatán del Lago Grande» (u otro distinto cada semana) tiene **vida compartida**. Cada miembro manda expediciones y su daño suma.
- Premios por tramos de daño total y por aporte personal.
- Una ruta `guilds/boss` en `sim.js`. El daño de cada envío se valida con la fuerza que el servidor ya conoce del jugador (`armyMultMax`).
- Si el gremio tiene pocos miembros reales, el servidor suma aportes de miembros simulados, como hoy hace el ayudante `D.GUILD_APPRENTICE`.

### S4. Visitar reinos

- Vista de solo lectura del reino de otro jugador, a partir de la «foto» que ya se manda en cada sync.
- Se puede dejar un **regalo** o un «me gusta». Hay un ranking de reinos más visitados.

### S5. Rankings y torneos

- **Categorías:** era, nivel de la Maravilla, piso más profundo, defensas ganadas y mayor jefe de gremio derrotado.
- La foto que manda cada sync suma esos datos, y el servidor los acota como ya hace con la era (no puede subir más rápido de lo posible).
- **Títulos semanales**, por ejemplo «Señor de las Profundidades».

### S6. Costos del servidor

- Mantener el sync cada 15 s y meter lo nuevo **dentro del mismo pedido**.
- Hay que medir el tamaño medio de la foto antes y después. La meta es no subir más del 20%.
- Revisar `FIREBASE.md` con los números nuevos antes de publicar S1 a S4.

---

## 8. Fase 6: Interfaz, celular y sonido

Tamaño: **M-L (3-4 sesiones)**. Se puede intercalar con otras fases.

### U1. Menú agrupado

Hoy hay 13 botones. Pasan a 5 grupos con submenú:

| Grupo | Contenido |
|---|---|
| **Reino** | Construir, Obras, Aldeanos, Logística, Territorio, Consejo |
| **Héroes** | Héroes, Taberna, Inventario |
| **Guerra** | Cuartel, Defensa, Batallas |
| **Mundo** | Explorar, Mercado, Gremio, Reinos |
| **Libro** | Misiones, Crónica, Álbum, Desafíos |

- Los atajos de teclado se mantienen (C, B, H, I…).
- El menú progresivo (`MENU_VER`) sigue funcionando por botón dentro de cada grupo.

### U2. «¿Qué hago ahora?»

- El panel Asesor (A6) más **la siguiente misión recomendada** de la Crónica.
- Reemplaza al panel de ayuda fijo, que hoy tapa el mapa hasta que se pulsa «Ocultar ayuda».

### U3. Tutorial guiado

- Los primeros 15 minutos, con **flechas y foco** sobre el botón que hay que tocar: Construir → Casa → Centro Urbano → Aldeano → Explorador…
- Se puede saltar, y se marca como hecho en `S.flags.tuto`.

### U4. Celular

- **Barra inferior con las 5 pestañas de U1**, que reemplaza a la columna de íconos sin texto.
- Minimapa plegable, más chico por defecto.
- El panel de ayuda se pliega solo después de la misión `m4`.
- Botón grande «Ocioso».
- Gesto de mantener pulsado sobre un edificio para mejorarlo.
- Se prueba en 390×844 y 844×390 con capturas antes y después.

### U5. Música y ambiente

- **Música procedural** con Web Audio, sin archivos, en la línea de `sfx.js`:
  - un tema tranquilo por cada grupo de eras;
  - una variante nocturna;
  - un tema de batalla que sube de intensidad con los jefes.
- **Ambiente según lo que está a la vista:** pájaros en el bosque, martillos cerca de la Herrería, agua junto a los lagos y viento en invierno.
- Volumen de música aparte del de efectos en Opciones, siempre bajo el control compartido y la tecla M (regla 7).

### U6. Accesibilidad

- Tamaño de texto (normal, grande).
- Modo para daltónicos: los íconos de recurso además cambian de forma y los colores de reino se marcan con un patrón.
- «Reducir movimiento»: sin temblor de cámara ni destellos en las batallas.

### U7. Pulido visual

- Maravilla más grande (V6), gólem y oso nuevos (C3).
- Retratos de héroe (H1).
- Transición al entrar a una batalla.
- Mejor contraste en los números de la barra superior cuando un recurso está lleno (hoy en rojo).

---

## 9. Fase 7: Técnica, pruebas y balance

Es un trabajo continuo. Cada fase deja estas piezas al día.

### T1. Piloto automático de pruebas (`tools/piloto.js`)

- Se carga con `?dev&piloto`. Juega como un jugador razonable:
  - sigue un plan de construcción por era, con calles (A7);
  - mantiene a los maestros de obras ocupados;
  - investiga, recluta y manda expediciones con probabilidad ≥ 80%;
  - reclama misiones.
- Anota en consola y en `window.pkPiloto.log` el **tiempo hasta cada era**, los aldeanos ociosos, los recursos llenos y las batallas ganadas y perdidas.
- Sirve para **medir el balance antes y después de cada cambio** (tabla de la sección 10) y para encontrar trabas como B2 y B5. Una versión de prueba de este piloto encontró los dos.

### T2. Time-lapse

Recuperar `tools/timelapse.js` (B6) o hacer que el piloto haga ese papel con `?timelapse`.

### T3. Pruebas automáticas (`colabtex/tests/prokingdoms.test.cjs`)

Hay que agregarla a `test:juegos` en `colabtex/package.json`. Carga `js/util.js` y `js/data.js` (y `js/world.js` donde haga falta) en Node con un `window` falso, como ya hace el servidor. Comprueba que:

- **Toda misión se puede cumplir:** cada estadística que piden misiones, diarias y semanales tiene quien la registre (`G.stat('…')`, o los prefijos dinámicos `g_`, `p_`, `sp_`, `floor_`, `z_`). Habría encontrado B3.
- Todo `pre` apunta a una misión que existe, y no hay ciclos.
- Todo edificio tiene `BDRAW`, `D.BSTATS` (si se mejora) y un lugar en `BUILD_ORDER`.
- Todo recurso especial tiene al menos un uso (costo de algo).
- Todo tipo de enemigo tiene al menos 2 tropas con ventaja > 1, y toda tropa tiene su entrada en `TROPA`.
- Los costos crecen con el nivel (`D.upCost`, `D.eraCost`, `G.techCost`).
- **POI estables:** los ids de `W.pois` de los tipos de hoy no cambian. Se guarda una huella (tipo, x, y de los primeros 300) y se compara.
- **B2:** en un mapa sintético, `placeWhy` rechaza el edificio que encierra al Centro Urbano.
- **B1:** `addJob` funciona con aldeanos que tienen `scared` negativo.

### T4. Rendimiento

- **Meta:** 60 fps con 300 unidades en un celular mediano. Hoy da 33 fps en un navegador sin GPU con 321 unidades.
- Aldeanos simplificados cuando la cámara está lejos (zoom 1): un sprite de 2 cuadros.
- Medir con el piloto en la Era VI.

### T5. Dividir `js/ui.js` (139 KB)

- Partirlo en `js/ui/*.js` por ventana: construir, aldeanos, cuartel, libro, héroes, consejo.
- Agregar cada archivo a `index.html` con su `?v=pk-N` en el orden correcto.
- Hacerlo **antes** de la Fase 2, que agrega varias ventanas.

### T6. Tamaño del guardado

- Héroes, equipo, incursiones y mapas suman datos. Hay que medir el JSON de una partida de la Era VI con 6 héroes y 60 objetos: tiene que quedar bajo 1 MB, porque el límite del servidor es `PK_SAVE_MAX` = 2 MB.
- Los objetos se guardan como semilla + rareza, no como texto completo.

### T7. Servidor

Por fase, la lista de lo que toca `server/sim.js`:

- margen de bonos (héroes, ánimo, estaciones, decoraciones);
- rutas nuevas (diplomacia, jefe de gremio, visitas);
- límites diarios.

Siempre:

- `node tools/cheat-test.js`;
- `cd functions && npm run prueba` con los emuladores;
- **despliegue manual por el dueño**.

---

## 10. Ritmo objetivo

Se mide con el piloto (T1), jugando sin trucos. Las cifras de «hoy» salen de la prueba del 3 de noviembre y de `D.eraTime` y `D.eraReq`.

| Hito | Hoy | Meta | Cómo |
|---|---|---|---|
| Era II | ~5 min | 5-8 min | Se mantiene. Es el gancho. |
| Era III | ~40 min | 30-45 min | Avisos de puestos avanzados (A5) y reserva clara (B4). |
| Primer héroe | (no existe) | antes de 30 min | La Taberna se abre con el Cuartel. |
| Primer jefe | (no existe) | 1-2 h | Piso 5 de una Guarida o Cueva. |
| Era IV | 3 h o más en la prueba (con las trabas de B2 y B5) | 1,5-2 h | El Consejo resuelve la economía. |
| Era V | varias horas (estimado según `data.js`) | 4-6 h | |
| Era VI y Maravilla | ~1 día (estimado) | 1-2 días | Elegir Maravilla (V6). |
| Era VII en adelante | días | días | Cartas de era, decretos, jefes de gremio. |

**Regla de oro:** en cualquier era, siempre tiene que haber **algo que decidir en los próximos 10 minutos**: un encuentro, un camino de incursión, un evento con opciones, un talento, una carta o un tratado.

---

## 11. Orden de trabajo y versiones

| # | Entrega | Contenido | Depende de | Tamaño | ¿Reinicia? |
|---|---|---|---|---|---|
| 1 | `pk-11` | **Fase 0**: bugs B1 a B8, herramientas de reinicio y protocolo (P1) y prueba T3 inicial | — | M | No (deja listo P1) |
| 2 | `pk-12` | Partir `ui.js` (T5) y piloto (T1, T2) | 1 | M | No |
| 3 | `pk-13` | **Fase 1**: A1, A2, A5, A6, A7 | 1, 2 | L | No |
| 4 | `pk-14` | Salón del Consejo y consejeros (A3), exploración dirigida (A4) | 3 | M-L | No |
| 5 | `pk-15` | **Héroes** (H1) y héroes en batalla (C2) | 2 | XL | Opcional |
| 6 | `pk-16` | **Mazmorras 2.0** con jefes y afijos (H3), escala visual de batalla (C3) | 5 | XL | Opcional |
| 7 | `pk-17` | Viajes, encuentros, eventos con opciones y mapas del tesoro (H2, H7, H8) | 5 | L | No |
| 8 | `pk-18` | **Campaña**, lugares legendarios y **todo el mapa nuevo** de una vez: lugares de H6, mazmorras de H4 y lugares únicos de la campaña (H5) | 5, 7 | L-XL | **Sí: el reinicio grande** |
| 9 | `pk-19` | Árbol 2.0, cartas de era y estaciones (V1, V2, V3) | 1 | L | No |
| 10 | `pk-20` | Ánimo, decoraciones, cercanía, Maravillas 2.0, muelle, desafíos y tienda (V4 a V9) | 9 | L | Opcional |
| 11 | `pk-21` | **Combate 2.0** (C1, C4 a C8), enemigos y tropas de H4 (las mazmorras ya están en el mapa desde `pk-18`) | 6, 8 | L-XL | No |
| 12 | `pk-22` y más | **Mundo vivo** (S1 a S5), directo en línea con el servidor | 5, 11 | XL | Opcional |
| — | (en paralelo) | **Fase 6**: menú agrupado, tutorial, celular, música y accesibilidad | 2 | M-L | No |
| — | (pendiente de decisión) | Prestigio «Nueva Dinastía» (V10) | 9, 10 | M | — |

Notas:

- Los números `pk-N` son orientativos. Lo obligatorio es subir la versión en cada entrega (regla 6).
- «Opcional» en la última columna quiere decir que se puede reiniciar si simplifica el trabajo, aprovechando la decisión 1 del dueño. Si dos entregas seguidas iban a reiniciar, conviene juntarlas en un solo reinicio.
- **Toda entrega que toque el servidor termina con el despliegue manual de la función** (`firebase deploy --only functions`) justo al hacer merge, para que cliente y servidor no se desfasen (regla 2).
- Las entregas 5 a 8 son la «mega actualización» propiamente dicha. Si hay que recortar, el orden de valor es **Héroes → Mazmorras 2.0 → Campaña → Viajes**.
- La Fase 0 no espera a nada: es la siguiente sesión.

---

## 12. Lista de control de cada entrega

- [ ] **Sin reinicio:** una partida guardada en la versión anterior carga sin perder nada. **Con reinicio:** se subieron `D.SAVE_V`, `D.MAPV` (si cambió el mapa) y `D.MUNDO_VER`, el mundo del servidor queda vacío en los emuladores y aparece el cartel de reinicio.
- [ ] Una partida nueva llega a la Era II sin errores en la consola.
- [ ] El informe «Mientras no estabas» después de 12 h simuladas (`?dev` → «Simular 3h offline», cuatro veces) da números razonables.
- [ ] `node tools/cheat-test.js` pasa si se tocó algo que el servidor ve.
- [ ] `cd colabtex && npm run test:juegos` pasa (incluye `prokingdoms.test.cjs`).
- [ ] Capturas en escritorio (1280×800), celular vertical (390×844) y horizontal (844×390) de cada ventana nueva.
- [ ] El silencio (tecla M) y el volumen compartido apagan todo lo nuevo que suena.
- [ ] Subido `?v=pk-N` en `index.html` y `PK_VER` en `colabtex/src/juegos/prokingdoms.js`, y corrido `npm run build`.
- [ ] Anotadas en `juegos/prokingdoms/CLAUDE.md` las decisiones nuevas, en pocas líneas.
- [ ] El piloto (T1) corre y anota los tiempos de era. Comparar con la entrega anterior.
- [ ] Si se tocó el servidor: `D.PROTO` subido si cambió algo que ven los dos lados, y aviso al dueño de que debe desplegar la función a mano justo al hacer merge.

---

## 13. Decisiones que debe tomar el dueño

**Ya decididas (3 de noviembre de 2026):**

- **Reinicios:** permitidos cuando hagan falta (regla 1).
- **Monedas del reino:** siguen separadas de las de Juegos.
- **En línea:** todo se implementa en línea de una vez, sin una versión local previa.

**Pendientes:**

1. **Prestigio «Nueva Dinastía» (V10).** ¿Sí o no?
   - *A favor:* da una meta cuando las eras ya tardan días, y deja probar otras elecciones (cartas, Maravilla, árbol) en una partida nueva.
   - *En contra:* a algunos jugadores no les gusta empezar de cero. En línea, la era baja, lo que mueve el ranking y el emparejamiento de conquistas (`D.canConquer` usa era y poder) y obliga a revisar el antitrampas de la era (`vera`, `LIM.eraGap`).
   - Recomendación: **decidir cuando los primeros jugadores lleguen a la Era X**. Hasta entonces no se implementa.
2. **Consumo de comida en invierno (V3).** ¿Bonos suaves o consumo real? Recomendación: **bonos suaves**, para no castigar al que se va 12 horas.
3. **Tope de héroes:** 6 por reino. ¿Más con la tienda? Recomendación: **no** vender héroes, solo cosméticos.
4. **Nombre de la actualización:** «Héroes y Fronteras» es una propuesta.
5. **Fin de la beta cerrada:** ¿se abre a todos con esta actualización (quitar `beta: true` en `SOLOS`)? Recomendación: después de la entrega 8, que trae el reinicio grande, para que todos empiecen juntos en el mundo nuevo.

---

## 14. Anexos: tablas de contenido nuevo

Son valores iniciales para implementar y después ajustar con el piloto.

### A1. Clases de héroe

| Clase | Rol | Pasiva al gobernar | Habilidad activa (recarga) | Rinde más contra |
|---|---|---|---|---|
| **Paladín** | Primera línea | Cuartel: +15% velocidad de entrenamiento | *Muro de escudos*: −50% de daño recibido por 8 s (30 s) | No-muertos, bandidos |
| **Guardabosques** | Tirador | Puesto de Exploradores: +20% alcance y caza +20% | *Lluvia de flechas*: área en una zona (25 s) | Bestias, dragón |
| **Clériga** | Apoyo | Monasterio: +20% oro de reliquias, −30% tiempo de heridas | *Plegaria*: cura 30% de vida a todos (40 s) | No-muertos |
| **Ingeniera** | Asedio | Taller u obra que gobierna: −10% tiempo de mejora | *Bombarda*: gran daño a un objetivo, ×3 contra gólems y gigantes (35 s) | Gólems, gigantes |
| **Hechicero** | Daño mágico | Biblioteca: +10% investigación | *Rayo encadenado*: salta entre 5 enemigos (30 s) | Arcanos, abisales |
| **Juglar** | Moral | Taberna o Centro Urbano: +10% a las fiestas, +1 encargo en el tablón, +5 de ánimo | *Canción de guerra*: +25% velocidad y daño por 10 s (45 s) | (apoyo) |

**Rasgos** al azar, uno por héroe: Valiente (+10% fuerza y +10% bajas propias), Prudente, Avaro (+botín de oro), Erudito (+XP), Robusto (heridas −50%), Veloz (viajes −15%), Suertudo (+rareza de botín).

**Talentos:** 8 escalones × 2 opciones por clase. Ejemplo para el Paladín, nivel 5: *Escudo de torre* (la habilidad dura +4 s) o *Carga sagrada* (la primera carga hace ×2).

### A2. Jefes de mazmorra

| Mazmorra | Jefe | Mecánica | Cómo se gana |
|---|---|---|---|
| Cueva de Cristal | **Corazón de Cristal** | Con 50% de vida se parte en 3 gólems medianos; los cristales del suelo explotan si alguien se queda encima | Caballería o catapultas, «Dispersarse» al partirse |
| Guarida de Bestias | **Matriarca Colmillo** | Aúlla cada 20 s e invoca 3 lobos que van por los tiradores | «Mantener línea» con lanceros; enfocar a la Matriarca |
| Catacumbas | **El Liche Sin Nombre** | Revive a los esqueletos caídos mientras no haya clérigos vivos; pantalla de sombra | Llevar clérigos y protegerlos; enfocar al Liche |
| Cráter Estelar | **Heraldo Estelar** | Marca círculos en el suelo y 3 s después caen meteoros | «Dispersarse» al ver las marcas |
| Nido del Dragón | **Ignivor el Antiguo** | Fases en el aire (solo le pegan arqueros, ballesteros y lanceros en línea) y en el suelo (fuego en cono) | Arqueros + lanceros + «Dispersarse» en el cono |
| Pantano de las Brujas | **La Madre del Pantano** | Maldice al grupo más fuerte (−50% daño); hay que «limpiar» con monjes o clérigos | Jinetes contra sus brujas, monjes para la maldición |
| Fortaleza de los Gigantes | **Rey Gorrag** | Golpe sísmico en área cada 15 s; con 30% de vida arroja rocas | Ballesteros a distancia, «Dispersarse» |
| Templo Hundido | **La Voz del Abismo** | Encanta a un grupo tuyo, que ataca a los suyos por 6 s | Magos de batalla; enfocar a las sirenas primero |

### A3. Afijos semanales (2 por semana)

| Afijo | Efecto | Premio |
|---|---|---|
| Niebla espesa | −40% alcance de los tiradores | +25% botín |
| Furia | Enemigos +20% daño | +40% botín |
| Tesoro escondido | +1 sala de Tesoro por incursión | — |
| Plaga | Sin curación de clérigos | +30% XP de héroe |
| Aliados espectrales | Al morir, un enemigo deja un espectro | +1 objeto garantizado |
| Suelo helado | Todos −20% velocidad | +20% recursos especiales |
| Noche sin luna | Escenario más oscuro, élites ×2 | +rareza de botín |
| Botín doble | — | ×2 botín, enemigos +30% vida |

### A4. Campaña: guion de los capítulos

1. **Era II, «El forastero de la capa».** Llega un viajero (el de la misión `l1`) que habla de una amenaza que viene del norte. Hay que construir la Taberna y reclutar al primer héroe. Termina en la batalla contra la banda de **Tuerto Valdés**.
2. **Era III, «El Rey Bandido».** Los campamentos se unen bajo un jefe. Hay que tomar 3 campamentos y después asaltar la **Fortaleza Bandida**, un lugar único. *Elección:* perdonarlo (se vuelve héroe Juglar) o ejecutarlo (se gana su tesoro).
3. **Era IV, «La reina Brunilda».** La vecina reclama tu frontera. Se resuelve por diplomacia (regalos y un tratado) o por la fuerza (defender un asedio). La elección cambia la relación con ella para siempre (S1).
4. **Era V, «La estrella caída».** La Orden del Cráter recoge hierro estelar a escondidas. Hay que investigar el Cráter y vencer al **Heraldo Estelar**.
5. **Era VI, «La Maravilla».** Hay que elegir y levantar la Maravilla (V6) mientras la Orden intenta sabotearla con eventos de incendio y robo.
6. **Era VII, «El despertar».** Temblores en las montañas. Hay que encontrar el **Cementerio de Dragones** (un lugar legendario) y vencer a una cría.
7. **Era VIII, «Las aguas oscuras».** Se abre el **Templo Hundido** y hay que derrotar a **La Voz del Abismo**.
8. **Era IX, «La alianza».** Hay que reunir a 3 reinos en una alianza (S1) para el asalto final.
9. **Era X, «Ignivor».** Asalto al **Nido** en la última fase: jefe a 3 fases con todos los héroes.
10. **Era XI, «La leyenda».** Un epílogo: coronación, una Maravilla dorada cosmética y el título «Leyenda del Reino». De aquí parte el prestigio (V10), si existe.

### A5. Encuentros en el camino (muestra de 12 de 30)

| Encuentro | Opciones |
|---|---|
| Puente roto | Repararlo (−madera, el viaje sigue) · Vadear el río (riesgo de herida) · Rodear (+tiempo) |
| Comerciante asaltado | Ayudarlo (pelea chica, +oro y relación) · Seguir de largo |
| Ermitaño del bosque | Escuchar su historia (+XP al héroe) · Comprar una poción (oro → cura en la incursión) |
| Lobos hambrientos | Pelear · Darles comida (−comida, sin pelea) |
| Santuario olvidado | Rezar (bendición para la incursión) · Saquear (+gemas, −ánimo) |
| Niño perdido | Llevarlo a casa (+ánimo, el viaje se atrasa) · Dejarlo con unos pastores |
| Caravana de gitanos | Cambiar recursos por un objeto al azar · Contratar a su adivina (revela un mapa del tesoro) |
| Emboscada | Cargar (+fuerza, +bajas) · Retirarse (pierde una sala de la incursión) |
| Cueva lateral | Explorar (sala extra al azar) · Ignorar |
| Desertores del Rey Bandido | Reclutarlos (+tropas, −relación con los bandidos) · Entregarlos (+oro) |
| Tormenta | Refugiarse (+tiempo) · Seguir (riesgo de herida, +XP) |
| Mapa en una botella | Seguirlo (mapa del tesoro) · Venderlo (+oro) |

### A6. Lugares legendarios

| Lugar | Bono permanente al investigarlo |
|---|---|
| Cascada del Alba | +5% comida |
| Árbol Madre | +5% madera; los árboles rebrotan un 10% antes |
| Círculo de Piedras | +5% investigación |
| Cementerio de Dragones | +10% contra dragones; escamas en el Álbum |
| Faro Abandonado | +3 de visión de las torres |
| Mina de los Enanos | +5% minería |
| Estatua del Rey Olvidado | +5 de ánimo |
| Pozo de los Deseos Antiguo | +1 deseo cada 3 días |
| Campo de Batalla Antiguo | +10% XP de tropas |
| Biblioteca Hundida | +10 libros por día |
| Colmena Gigante | Fiesta del pueblo −20% de costo |
| Puerta de las Estrellas | Las incursiones se reponen un 15% antes |

### A7. Eventos nuevos (20)

| Evento | Qué pasa | Opciones o acción |
|---|---|---|
| Incendio en el pueblo | Un edificio arde; si no se apaga, pierde un nivel | Mandar aldeanos con baldes (toque) · Dejarlo (−1 nivel) |
| Plaga de langostas | −50% granjas por 3 min | Quemar campos (−comida, termina antes) · Esperar |
| Peregrinos | Piden comida | Darla (+ánimo, +oro de reliquias por 10 min) · Negarla |
| Torneo de caballeros | Se puede inscribir a un héroe | Inscribir (pelea de exhibición, premio) · Mirar (+ánimo) |
| Visita del rey | Pide un tributo | Pagar (+relación con todos) · Excusarse |
| Cometa en el cielo | 5 min de +20% investigación | — |
| Inundación | Un campamento junto al agua se cierra 2 min | Diques (−piedra) · Esperar |
| Ladrón nocturno | Roba oro de a poco | Atraparlo (tocarlo en el mapa) |
| Niño perdido | Se perdió en el bosque | Mandar al explorador (+ánimo, +cofre) |
| Boda real | Invitación de un reino vecino | Ir (regalo, +relación) · Declinar |
| Mercader de mapas | Vende un mapa del tesoro | Comprar · Regatear (50%: precio a la mitad o se va) |
| Huevos de grifo | Encontrados en las rocas | Criarlos (Casa de Fieras: montura de héroe) · Venderlos |
| Terremoto | Revela una veta de gemas temporal | — |
| Bardo errante | +10 de ánimo por 10 min | Pagarle para que se quede una hora |
| Cosecha récord | +100% granjas por 2 min | — |
| Fiebre en el pueblo | −20% velocidad de aldeanos | Clérigos o Clériga la curan · Esperar |
| Gremio de constructores | −20% al costo de las obras por 5 min | — |
| Espía capturado | Trae información de un reino | Interrogarlo (ver su defensa) · Liberarlo (+relación) |
| Desertores | 10 soldados piden entrar | Aceptarlos (+tropas) · Rechazarlos |
| Lluvia de meteoros menor | Fragmentos con hierro estelar | Recogerlos (como la estrella fugaz) |

### A8. Árbol de tecnologías 2.0 (muestra)

- **Economía:**
  - Rotación de cultivos: las granjas suben +2 niveles máximos;
  - Graneros comunitarios: +20% de tope de comida (excluyente con la anterior en la Era III);
  - Caminos empedrados: caminos ×1,5;
  - Moneda acuñada: el Tesorero vende al 80%;
  - Pesca con redes: muelle +30%.
- **Industria:**
  - Molino de agua: el Aserradero junto al agua +25%;
  - Altos hornos: Fundición +1 puesto;
  - Imprenta: libros ×2, excluyente con *Escribas devotos* (+reliquias);
  - Cintas reforzadas: cintas ×1,5;
  - Pólvora (Era VI): catapultas → cañones.
- **Guerra:**
  - Herraduras: jinetes +20% velocidad;
  - Ballestas de palanca: ballesteros +15%;
  - Medicina de campaña: −20% bajas;
  - Fortines: torres +1 rama;
  - Doctrina: +1 talento de héroe.
- **Saber:**
  - Cartografía avanzada: un segundo explorador dirigido;
  - Astronomía: +1 sala de Misterio por incursión;
  - Diplomacia: tratados más baratos;
  - Alquimia: pociones del Herbolario ×2;
  - Archivo real: +1 en la cola del Mayordomo.

### A9. Cartas de era (muestra)

- **Fiebre del oro:** +30% oro, −10% comida.
- **Brazos fuertes:** +15% madera y piedra.
- **Escuela de oficios:** +20% talleres, −10% recolección.
- **Puertas abiertas:** +20% comercio, −10% defensa.
- **Muros altos:** +30% defensa, −10% velocidad de obras.
- **Sangre joven:** aldeanos 30% más rápidos de entrenar.
- **Veteranos:** +1 rango a todas las tropas.
- **Tierra fértil:** +2 niveles máximos a las granjas.
- **Mapas antiguos:** revela 2 mazmorras cercanas.
- **Patronazgo:** +1 héroe en la Taberna cada día.
- **Fiestas populares:** fiestas −30% de costo.
- **Mercaderes amigos:** el mercader errante aparece el doble.
- **Arquitectos del rey:** −15% tiempo de mejora, +10% costo.
- **Cazadores de dragones:** +25% contra dragones.
- **Bibliotecarios:** +20% investigación.

### A10. Decoraciones

Farol (+1 de ánimo, radio 3), Banca, Pozo, Árbol frutal (+comida chica), Estatua del fundador, Fuente (+2 de ánimo, radio 5), Jardín de flores, Plaza adoquinada (bonus de casas), Estandarte del reino, Arco de triunfo (solo por logros), Escenario del juglar, Columna conmemorativa (por jefe vencido), Glorieta, Estanque con peces, Hoguera de fiesta.

---

*Este plan sale de la prueba del 3 de noviembre de 2026. Las capturas y el piloto que se usaron quedaron en el entorno de esa sesión. Los bugs B1 a B3 se reprodujeron en el navegador. Los B4 a B8 se confirmaron leyendo el código y viendo la pantalla.*
