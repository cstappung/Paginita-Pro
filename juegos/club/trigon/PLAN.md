# Trigon — plan de implementación

Puzzle de un jugador inspirado en *Trigon* (iOS): un tablero hexagonal de
triángulos, tres piezas por tanda que se arrastran al tablero, y líneas que
se borran al completarse en cualquiera de las **tres direcciones**
(horizontal y las dos diagonales). La partida acaba cuando ninguna pieza de
la mano cabe.

Archivos en `juegos/club/trigon/`:

| Archivo | Qué hace |
|---|---|
| `motor.js` | Geometría de la red triangular, piezas y orientaciones, colocar, líneas, puntos, azar con semilla. Sin DOM: corre en Node. |
| `juego.js` | Dibujo SVG, arrastrar y soltar, sonido, marcador, fin de partida. |
| `estilo.css` | La piel (tablero morado oscuro, piezas pastel). |
| `index.html` | La página, con el conector del Club (`../conexion.js`). |

Probar en local, desde la raíz del repo:

```
python3 -m http.server 8123
```

y abrir <http://localhost:8123/juegos/club/trigon/index.html>.

---

## Fase 1 — Núcleo jugable (página suelta) ✅

- [x] ~~Clonar el repo y crear la rama `trigon`~~
- [x] ~~Estudiar 2048 (`juegos/club/dosmil/`) como plantilla~~
- [x] ~~Motor: red triangular en coordenadas axiales, hexágono de lado 4 (96 triángulos)~~
- [x] ~~Motor: 24 líneas (8 por dirección) y detección de líneas completas~~
- [x] ~~Motor: 8 formas de pieza con todos sus giros y espejos, reparto con semilla (mulberry32)~~
- [x] ~~Motor: colocar, borrar líneas simultáneas, puntos (+1 por triángulo, bono 20/60/120… y multiplicador de racha), fin de partida~~
- [x] ~~Prueba rápida del motor en Node (300 partidas al azar sin inconsistencias)~~
- [x] ~~Pantalla: tablero SVG con juntas, mano de tres piezas a escala común~~
- [x] ~~Arrastrar y soltar con ratón y dedo (Pointer Events), imán a la posición válida más cercana~~
- [x] ~~Vista previa: fantasma de la pieza y realce de las líneas que se cerrarían~~
- [x] ~~Efectos: estallido de triángulos, cartel de línea/racha, +puntos, sonidos WebAudio~~
- [x] ~~Piezas que no caben se ven apagadas; capa de fin de partida con récord~~
- [x] ~~Récord guardado en el navegador~~
- [x] ~~Revisión en navegador: escritorio y celular (375 px), sin errores en consola~~
- [x] ~~Arreglo: la pieza arrastrada ahora se ve siempre (antes solo aparecía el fantasma sobre casillas libres; el `<svg>` flotante nunca perdía su atributo `hidden`)~~
- [x] ~~Arreglo: el juego quedaba corrido a la izquierda (la columna vacía del ranking ocupaba 285 px); ahora centrado~~
- [x] ~~Escritorio (≥ 760 px): tablero más grande (hasta 700 px) y las piezas en una columna a la derecha; en celular siguen abajo~~

## Fase 2 — Menú, pulido y sensación de juego ✅

**Menú de inicio** (cubre tablero + piezas; aparece al entrar sin partida guardada, desde ☰ y desde el fin de partida):

- [x] ~~Botón **Jugar** (partida nueva) y **Volver a la partida** si se abrió con ☰ a mitad de juego~~
- [x] ~~**Tu mejor puntaje** (récord personal) y partidas jugadas~~
- [x] ~~**Clasificación**: récord más alto de todos y top 10 con tu fila resaltada. Escucha el mensaje `ranking` de Juegos para la categoría `club-trigon-puntos`; suelto muestra «Abre Trigon desde Juegos…». *Probado con un iframe y datos falsos; con datos reales llega en la fase 3.*~~
- [x] ~~Botón ☰ en la barra y ☰ Menú en la pantalla final~~
- [x] ~~«¿Cómo se juega?» desplegable con las reglas y los atajos de teclado~~

**Sin menú de pausa** (descartado): la barra ya tiene ↻ Nueva, silencio y volumen. En la fase 2.1 se suma ahí un botón 🎨 **Tema**.

**Guardado (todo local, nada en la nube salvo el puntaje):**

- [x] ~~La partida en curso se guarda solo en `localStorage` como semilla + jugadas (cero datos de Firebase); el motor la rehace al volver~~
- [x] ~~Si recargas o vuelves antes de 24 h desde la última jugada, sigue donde estaba; si pasó más, se descarta y aparece el menú~~
- [x] ~~El récord personal y las partidas jugadas se guardan en local~~
- [ ] Subir el puntaje final a la nube para la clasificación → fase 3

**Pulido:**

- [x] ~~Animación de mano nueva (las piezas entran saltando) y de pieza devuelta (vuela de vuelta a su ranura)~~
- [x] ~~Balance: si ninguna pieza de una mano nueva cabe, se vuelve a repartir (hasta 4 intentos, determinista)~~
- [x] ~~Bono visible: el cartel muestra «BONO ×N» con la racha; la pantalla final muestra la mejor racha~~
- [ ] Comparar la puntuación con el Trigon original (necesita tu opinión jugando)
- [ ] Música de fondo / mejores sonidos (opcional)
- [x] ~~Teclado: 1-2-3 eligen pieza, flechas mueven el fantasma (rojo si cae sobre fichas), Enter suelta, Esc cancela~~
- [ ] Mando (gamepad) → opcional, con `Mando.configura` como los otros juegos
- [ ] Probar en un iPhone/Android de verdad (tamaño de las piezas, que el dedo no tape)
- [x] ~~Celular apaisado: tablero a la izquierda, mano a la derecha, todo cabe a lo alto~~
- [x] ~~Arreglo: en celular la tercera pieza se salía de la pantalla (ranuras de 150 px fijos)~~

## Fase 2.1 — Temas visuales ✅

Cambiar el aspecto completo del juego sin tocar las reglas. Cada tema tiene
**modo oscuro** (por defecto) y **modo claro**.

- [x] ~~Sistema de temas: variables CSS por tema y modo en `temas.css` (`[data-skin]` y `[data-skin][data-modo="claro"]`); `estilo.css` ya no tiene colores fijos~~
- [x] ~~Los colores de las piezas pasaron de `juego.js` a variables (`--p1`…`--p8`), así el tema los controla~~
- [x] ~~Botón 🎨 en la barra: selector con miniatura de cada tema (cada tarjeta se pinta con sus propios colores), interruptor 🌙 Oscuro / ☀️ Claro y «Listo»~~
- [x] ~~Se cambia en plena partida sin perderla; la elección se recuerda en el navegador y se aplica antes de pintar (sin parpadeo)~~
- [x] ~~**Clásico**: morado noche, piezas pastel (el original)~~
- [x] ~~**Halloween**: noche morada, luna naranja, murciélagos; piezas naranja, lima y violeta~~
- [x] ~~**Gris**: todo en escala de grises (en claro, piezas oscuras sobre gris claro)~~
- [x] ~~**Forest**: bosque de noche en calipso y celeste, pinos al pie de la pantalla y luna~~
- [x] ~~**Espacio**: negro con estrellas en mosaico y un planeta; piezas neón~~
- [x] ~~Revisión de los 10 (5 temas × 2 modos) en escritorio, y del selector en celular~~
- [x] ~~Celebración por tema al cerrar líneas: **Halloween** 🎃🦇🧛👻 saltan desde la línea (y una bandada de murciélagos con 2+ líneas); **Espacio** un 🚀 por línea cruza en diagonal con ✨; **Forest** luciérnagas que suben; **Gris** los triángulos estallan en arcoíris con una onda; **Clásico** el estallido de siempre. Se desactivan con «reducir movimiento» del sistema~~
- [ ] Sonidos por tema (p. ej. Halloween más grave) → opcional
- [ ] Tema de temporada automático (Halloween en octubre) → opcional
- [ ] Temas desbloqueables con monedas → opcional, después de la fase 3
- [ ] Probar con alguien daltónico o con un simulador (Gris y Forest tienen piezas parecidas entre sí)

## Fase 3 — Integración en el Solo Club ✅ (falta el PR)

**El juego:**

- [x] ~~Dos relojes (`performance.now` y `Date.now`) que se paran sin foco o con la pestaña oculta~~
- [x] ~~Cada jugada registra su origen (ratón, dedo, teclado o sintética) y los ms enteros desde la anterior~~
- [x] ~~Al terminar (o al abandonar con ↻ Nueva) manda el puntaje con `Club.result` y su prueba `{v, s, u, j, a, w, fin}`; las partidas con eventos sintéticos no se mandan~~

**Antitrampas:**

- [x] ~~Verificador `colabtex/src/juegos/solo/verifica/trigon.js`: rehace la partida con el mismo `motor.js`, exige puntaje y tiempo exactos, rechaza eventos sintéticos, relojes alterados, pruebas de otra cuenta y ritmos de programa~~
- [x] ~~Documentado en `docs/antitrampas/trigon.md` y en la tabla de `docs/antitrampas.md`~~

**Registro en el sitio:**

- [x] ~~Salón (`salon-datos.js`): ficha «Trigon», género Puzle, 🔺, con candado para invitados como el resto del Club~~
- [x] ~~Ruta `#solo/trigon`, iframe (`solo/club.js`), popularidad y clasificación (`ranks.js`, categoría `club-trigon-puntos`)~~
- [x] ~~Novedad en el carrusel de Juegos y portada SVG (`portadas-solo.js`)~~
- [x] ~~Manual (`reglas.js`) con dos ejemplos ilustrados paso a paso (`reglas-ejemplos.js`, `reglas-ilustraciones.js`)~~
- [x] ~~Monedas (`monedas.js`): 15 por partida terminada, 1 por cada 100 puntos de récord y los podios~~
- [x] ~~10 logros de puntaje, de 100 a 20 000 (`logros.js`), calibrados con un bot: uno simple ronda los 300~~
- [x] ~~Podio de Discord, perfil y vistas de logros y monedas~~
- [x] ~~Reglas de Firebase: `soloRanks`, su tope de 1 000 000, `soloPruebas` y `clubJugadas`~~
- [x] ~~Guardar la partida en la cuenta → descartado: la partida en curso vive solo en local~~

**Calidad:**

- [x] ~~`colabtex/tests/trigon.test.cjs` (11 tests: geometría, motor, verificador, reglas) y Trigon en los tests que enumeran juegos~~
- [x] ~~`npm run test:juegos`: 583/583~~
- [x] ~~`npm run build` y revisión en `juegos.html` como invitado (ficha, novedad, portada y manual)~~
- [x] ~~Docs: `CLAUDE.md` y `firebase/CONFIGURAR-FIREBASE.md`~~
- [ ] Probar con sesión iniciada: jugar desde Juegos, que el puntaje entre a la clasificación y paguen las monedas
- [ ] Publicar las reglas de Firebase (lo hace la dueña del sitio; sin eso se juega igual pero no entra a la clasificación)
- [ ] Commit y Pull Request al repo original

**Quedó fuera (opcional, para después):** marco de campeón en el perfil, repeticiones de partidas (replays) y la fila de Trigon en los carruseles de récords del salón.
