# Correr con tu mascota o tu rockero de Pro Hero — plan para una actualización posible

*Escrito el 2026-11-09. **No está en el plan vigente** (`PLAN.md`, `docs/plan-combinado.md`): es una idea evaluada y
guardada para una actualización futura, si el dueño la pide. Nada de esto está hecho ni probado en el juego: sale de
leer los archivos de pilotos del disco, una skin de Retro Rewind y el código de los modelos del sitio.*

## La idea en tres líneas

1. Hoy cada jugador de la sala se ve como el personaje de Mario Kart que eligió y, donde el juego muestra una cara,
   como un Mii invitado (§98).
2. El sitio ya tiene dos «personajes propios» de cada cuenta: su **mascota** (Mascotas) y su **rockero** (Pro Hero).
3. La propuesta es que cada uno pueda correr con **su mascota o su rockero de verdad**, con su figura, su ropa y sus
   colores. Es opcional por jugador y viene apagado.

## Decisión del dueño (2026-11-09)

- Primero aceptó el camino barato (un personaje del juego parecido, con los colores del jugador). Después lo cambió:
  **«es mejor fijar el ambicioso de una, el fiel»**.
- **El camino elegido es el fiel**: la figura propia de cada jugador armada sobre el esqueleto del juego.
- **El camino barato queda como reserva**, por si el piloto del fiel no se ve bien o cuesta rendimiento.
- No entra al plan ahora.

## Glosario corto

| Término | Qué es |
|---|---|
| **Skin** | Otro «traje» para un personaje del juego: el mismo esqueleto y las mismas animaciones con otra figura. Retro Rewind trae unas 120 (carpeta `Character/`, archivos `<kart>-<personaje>-<número>.szs`). Como cambiarle la carcasa a un equipo sin tocar el circuito. |
| **Mii** | El muñeco configurable de la Wii. Se define con una lista corta de elecciones (cara, ojos, cejas, peinado, barba, tono de piel, color de pelo, color favorito) guardada en 74 bytes. |
| **Teñir** | Cambiar el color de una textura (la imagen que envuelve el modelo) sin cambiar su dibujo. Como poner un filtro de color sobre una foto. |
| **«Look»** | La ficha que guarda el sitio con lo que eligió cada cuenta para su rockero (`rockLook/<uid>` en Firebase). |
| **Esqueleto / huesos** | Los puntos de giro de un modelo 3D (cadera, brazo, cabeza…). Las animaciones del juego mueven huesos, y la figura los sigue. Los pilotos del juego tienen 15. |

## Lo que se encontró

**En el sitio** (`terceros/Paginita-Pro`, copia local del 2026-10-24):
- **Mascotas:** solo dos especies, gallina (huevo → pollito → gallina) y gato (caja → gatito → gato). El color del
  plumaje o del pelaje sale de sus «genes». El sitio ya sabe sacarle una foto a cualquier mascota
  (`colabtex/src/juegos/visor-mascota.js`, `fotoDe`).
- **Rockeros:** humanoides hechos de cajas, cilindros y esferas, con esqueleto propio. El «look» elige cuerpo
  (masculino o femenino), forma de cara, ojos, cejas, pelo, barba, ropa, zapatos, guantes, guitarra, collares, aros,
  tatuajes y colores (`juegos/hero/js/rock/catalogo.js`, `ED_CAT`). No hay todavía un fotógrafo de rockeros.

**En el juego:**
- Cada piloto con su kart es un archivo con un esqueleto de 15 huesos, su figura, sus texturas y 17 animaciones.
- Retro Rewind elige la skin **por puesto** de la carrera (12 casillas), y nuestra sala ya reparte las skins de las CPU
  entre consolas (`web/juego/nombres_nativo.cpp`, `estado.skins`).
- La página ya sabe crear y editar un Mii (`web/navegador/mii.mjs`, `editor-mii.mjs`), la sala ya le pone un Mii a
  cada humano (§98) y ya sabemos leer y escribir texturas de la Wii (`web/navegador/textura-gx.mjs`).

## El camino fiel (el elegido)

**La idea.** El juego ya acepta pilotos cambiados: una skin es el mismo esqueleto y las mismas animaciones con otra
figura (la de Bone Koopa trae incluso 18 huesos en vez de 15, y el juego la carga igual). Entonces la página arma, en
el navegador de cada jugador, una «skin» con la figura del rockero o de la mascota:

1. El sitio entrega **las piezas** del personaje (triángulos, colores, la textura de la cara) en vez de una foto.
2. La página abre el archivo del piloto que el jugador eligió, **conserva su esqueleto y sus animaciones** y cambia la
   figura: cada pieza queda pegada rígida a su hueso, como un muñeco articulado, y estirada al largo de ese hueso.
3. El juego lo carga como una skin más, en el puesto de ese jugador. Las animaciones del juego (manejar, derrapar,
   celebrar, lanzar) mueven la figura.

La carrera no cambia: el peso y las estadísticas siguen siendo los del personaje elegido; solo cambia lo que se ve.

**Rockeros.** Es el caso natural: el rockero es un humanoide con esqueleto propio (cadera, pecho, cuello, cabeza,
brazos, codos, piernas, rodillas) y sus partes calzan casi una a una con los 15 huesos del juego. Pasan el pelo, la
ropa, los colores, la cara y lo especial (guitarra a la espalda, collares, pelos legendarios) mientras sean piezas.

**Mascotas.** No son humanoides: la gallina o el gato irían como una figura sentada en el asiento, con el cuerpo
pegado al torso y la cabeza al hueso de la cabeza, sin manos al volante. Llevan su ropa, sus accesorios y su etapa
(huevo, pollito, gallina; caja, gatito, gato). Es lo más incierto de ver.

### Lo difícil

- **Escribir el formato de modelos de la Wii.** Hoy solo sabemos leerlo (`herramientas/brres.mjs`); el formato es
  público (Tockdom). Es la pieza más grande de programar.
- **El calce.** Los esqueletos cambian según personaje y kart (Baby Mario tiene brazos cortos). En los personajes
  chicos puede verse raro, y solo se resuelve mirando. Es el riesgo principal.
- **El rendimiento.** Las esferas del sitio traen muchos triángulos y el juego frena por la CPU: hay que rehacerlas
  con menos, al nivel de un piloto normal, y medirlo en la gama baja simulada y en este PC.
- **Otros lugares donde aparece el piloto:** el modelo lejano, la selección de personaje y el podio.
- **Las caras 2D** (minimapa, lista de puestos, tabla de resultados): ahí va una foto del personaje en el lugar de la
  cara del Mii. Para las mascotas el sitio ya tiene fotógrafo; para los rockeros hay que agregarlo.

### Los trabajos, en orden

**El piloto (una semana; decide si se sigue):**
1. Sacar las piezas de un rockero del sitio a un archivo de prueba (sin tocar el sitio publicado).
2. El armador de modelos de la Wii en la página, con su prueba en el banco (un modelo de mentira con la forma de los
   del juego).
3. El gancho que hace que el juego cargue ese archivo en el puesto del jugador; una carrera directa con un rockero
   fijo sobre un personaje mediano y un solo kart; **foto y medición de CPU** contra el piloto normal.

**Si el piloto pasa:**
4. El calce en todos los cuerpos (chicos, medianos, grandes; karts y motos).
5. Las mascotas: su exportador y su calce como figura sentada.
6. Los otros lugares: el modelo lejano, la selección de personaje, el podio y las caras 2D.
7. La sala: la anfitriona reparte el «look» o la mascota de cada uno y todas las consolas arman el mismo archivo.
   Comprobar que la carrera sigue idéntica (huellas de `prueba-sincro`, `prueba-sala`).
8. El sitio: el exportador de piezas dentro de Pro Hero y de Mascotas, leer el «look» y la mascota de los demás
   (revisar que las reglas de Firebase lo permitan) y la opción en el vestíbulo. Es un PR en Paginita-Pro: **se le
   avisa al dueño y se espera su confirmación**; las reglas de Firebase las publica él.

**Tamaño estimado:** 3 a 5 semanas para los rockeros en la carrera, con el calce como la parte incierta; las
mascotas, una o dos semanas más.

## El camino barato (reserva)

### Mascotas → una skin parecida, teñida

1. **Tabla especie → skin.** Para el gato existe «Meowser» (una skin de Bowser). Para la gallina hay que revisar la
   lista de skins de Retro Rewind con sus nombres y elegir la más parecida. **Pendiente: no está revisada.**
2. **Teñir** la textura de esa skin con el color de la mascota de cada jugador, para que dos gatos se distingan.
3. **Asignar** la skin al puesto del jugador, con el mecanismo que ya reparte las skins de las CPU.

### Rockeros → un Mii parecido, con sus colores

Una tabla de equivalencias del «look» al Mii:

| Del rockero | Al Mii |
|---|---|
| Cuerpo masculino / femenino | Mii masculino / femenino |
| Forma de cara, ojos, cejas | La más parecida del catálogo del Mii |
| Pelo (melena, cresta, corto, rapado, coletas…) y su color | El peinado más cercano y su color |
| Barba (tres días, perilla, bigote, completa) | Barba y bigote del Mii |
| Color de la ropa de arriba | Color del traje del Mii (tiñendo su textura) |

De paso sirve para las caras 2D: la cara del Mii es la que el juego muestra en el minimapa, la lista de puestos y la
tabla de resultados cuando se corre como Mii.

### Lo que no pasa (hay que aceptarlo)

- **Mascotas:** no es la mascota exacta. No lleva su ropa, sus accesorios ni su etapa de crecimiento.
- **Rockeros:** se ve como un Mii que se parece, no con el estilo de bloques de Pro Hero. No pasan la guitarra, los
  tatuajes, el maquillaje, los collares, los aros, los guantes ni los pelos legendarios (quedan como el peinado común
  más cercano con ese color).
- **El peso.** La skin es de un personaje concreto (Meowser es Bowser, un pesado) y el Mii pesa según su tamaño. Ver
  «Decisiones abiertas».

### Los trabajos, en orden

1. Revisar las skins de Retro Rewind con sus nombres y armar la tabla especie → skin.
2. Armar la tabla «look» → Mii y su prueba en el banco (con «looks» de mentira).
3. El teñido de texturas (skin de la mascota, traje del Mii) y su prueba en el banco.
4. El gancho que asigna la skin o el Mii al puesto del jugador; la foto en una carrera directa.
5. La sala: la anfitriona reparte la mascota o el «look» de cada uno y todas las consolas arman lo mismo. Comprobar
   que la carrera sigue idéntica (huellas de `prueba-sincro`, `prueba-sala`).
6. El sitio: leer la mascota y el «look» de los demás jugadores (revisar que las reglas de Firebase lo permitan) y la
   opción en el vestíbulo. Es un PR en Paginita-Pro: **se le avisa al dueño y se espera su confirmación**; las reglas
   de Firebase las publica él.

**Tamaño estimado:** alrededor de una o dos semanas con las pruebas. No cuesta rendimiento: son
pilotos normales del juego. La carrera no cambia: solo cambia lo que se ve.

## Decisiones abiertas (del dueño, cuando se retome)

1. **¿Opcional por jugador y apagado por omisión?** Es la propuesta.
2. **¿Sobre qué personaje se arma?** Con el camino fiel el jugador elige personaje libremente (de ahí salen el peso y
   el esqueleto) y encima va su figura. La alternativa es fijar un cuerpo mediano para todos, que calza mejor pero
   quita la elección de peso.
3. **¿Las mascotas entran en la primera entrega** o se parte solo con rockeros?
4. Si el piloto del camino fiel no pasa, **¿se hace el barato?**

## Reglas que siguen valiendo

- Siempre 12 karts; la carrera idéntica entre consolas; cada pieza con su prueba en el banco.
- Nada del juego ni de Retro Rewind a git: las skins teñidas y los archivos armados se generan en el navegador de
  cada jugador y nunca se suben.
- PR en Paginita-Pro y reglas de Firebase: solo con la confirmación del dueño.
