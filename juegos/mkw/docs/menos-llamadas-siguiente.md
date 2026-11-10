# Menos llamadas a Cloudflare y R2: lo que queda para una actualización futura

**Estado:** pospuesto por el dueño el 2026-11-09 a las 22:40. Sus palabras: «lo que queda es entonces habilitar la
habitación del multijugador y publicar lo nuevo, todo lo demás a una futura update».

No se cambió el Worker ni la página (`lote.mjs`, `disco.mjs`…) ni `subir-r2.mjs`. El programa que se publica quedó como
estaba. Lo único que se escribió fueron instrumentos de medición, guardados en
[`parches/pendiente-menos-llamadas.diff`](../parches/pendiente-menos-llamadas.diff) y sin aplicar:

- `worker-local.mjs` cuenta cada lectura de R2 por tipo (get/head) y sus bytes, y las firmas de token que se verifican
  de verdad. Con `MKW_BORDE=1` agrega una caché de Cloudflare de mentira, que equivale al Worker con dominio propio.
- `medir-sitio.mjs` imprime la línea «R2 (§264)» y tiene `--otra-persona`: la 2.ª visita en un navegador nuevo.

Para retomar: `git apply parches/pendiente-menos-llamadas.diff`. La tanda que se usó está guardada en la carpeta de notas
compartida de las sesiones (`r264-tanda.sh`). Corre `medir-sitio`, `prueba-experiencia` y `medir-carrera-entera` con
el candado.

## La línea base (medida el 2026-11-09 entre 22:23 y 22:36)

Se midió con el programa final `build/web-final-w30/navegador`, la página de Juegos real y el Worker de verdad corriendo
en esta PC (`worker-local.mjs`). Hay que contar dos cosas por separado:

- **las llamadas al Worker**: es lo que cobra Cloudflare, 100.000 al día gratis, y las preguntas previas de CORS también
  cuentan;
- **las lecturas de R2** (get y head): son las «operaciones clase B», 10 millones al mes gratis.

| Caso | Llamadas al Worker | Lecturas de R2 | MB bajados |
|---|---|---|---|
| 1.ª visita, hasta la carrera | **92** (79 lotes, 7 preguntas CORS, 2 del programa, 2 semillas, 1 manifiesto, 1 diminutos.bin) | 332 | 207 |
| 2.ª visita (el mismo navegador, con su caché) | **16** (15 lotes y el manifiesto) | 25 | 6,7 |
| 2.ª persona (otro navegador) con la caché de Cloudflare | 84 | **39** (266 de 298 pedazos salieron de la caché) | 201 |
| 1.ª visita con la red a 20 Mbit/s | 121 (108 lotes: con menos ancho, más pedidos urgentes de un pedazo) | 279 | 185 |
| Con la carrera andando | **0** | 0 | 0 |

Otros datos de esas mediciones:

- Cada visita verifica **una sola firma** de token. La memoria `vistos` del Worker ya basta, así que guardar la
  verificación unos minutos no ganaría nada.
- En la 1.ª visita, los lotes llevan 325 pedazos en 79 llamadas, unos 4 por llamada. El mayor llevó 12, que es el tope.
- **Lo que no alcanzó a medirse:**
  - **La sala.** `prueba-experiencia` se cortó por un clic que no respondió en 30 s (no por la red), con 58 llamadas
    hasta ese punto: 9 preguntas CORS y 42 lotes. Ni la copa entera ni una carrera de la sala tienen número todavía.
  - **Cada carrera por separado.** `medir-carrera-entera` (pistas 0.0, 13.2 y 13.2 en un perfil) se detuvo al pedir el
    alto.
  - **El tiempo hasta jugar.** Está en los `.json` de abajo, sin comparar todavía.
- **Cuántos jugadores caben con 100.000 llamadas al día:** unas **1.080 primeras visitas** o unas **6.250 visitas
  repetidas**. Una mezcla realista (1 nueva por cada 5 repetidas, más las salas) queda alrededor de 3.000 a 4.000
  partidas al día.

Los datos crudos están en `build/web/datos/r264/` y `build/web/datos/medir-sitio/r264-*`. Están ignorados por git
porque contienen nombres de archivos del juego.

## El límite que manda: 50 operaciones de caché por llamada

En el plan gratis de Workers, cada llamada tiene dos topes distintos:

| Qué | Tope por llamada |
|---|---|
| Pedidos a servicios de Cloudflare (R2, KV, D1) | 1.000 |
| `fetch()` hacia afuera **y la Cache API** (`caches.default.match/put/delete`) | **50** |

Fuentes: [Workers — límites](https://developers.cloudflare.com/workers/platform/limits) y
[el cambio del 2026-02-11](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/).

Hoy cada pedazo de un lote gasta hasta 3 operaciones: mirar la caché, leer R2 y guardar en la caché. Por eso el lote
tiene un tope de **12 pedazos** (`MKW_LOTE_PIEZAS` en el Worker y `maxPiezas` en `lote.mjs`). La que limita es la caché,
no R2.

Hay un detalle más: en `*.workers.dev` la caché no guarda nada, pero cada `match` y `put` igual gasta de esas 50. La
caché solo ahorra lecturas con un dominio propio. Con él, la 2.ª persona baja de 307 a 39 lecturas de R2 (−87 %), pero
el número de llamadas no cambia.

## Las ideas, ordenadas por lo que ganarían en llamadas

1. **Juntar en el Worker los pedazos seguidos de un mismo archivo.** Una sola lectura de R2, un `match` y un `put` por
   tramo, y el tope del lote cuenta tramos, no pedazos. El Worker avisa con una cabecera que lo sabe hacer, y solo
   entonces la página sube `maxPiezas` (por ejemplo, 64 pedazos y 32 MB); con un Worker viejo sigue en 12. Es lo que más
   gana con menos riesgo:
   - en la 1.ª visita, la fila de fondo (la semilla de bloques) lleva más de 300 pedazos casi siempre seguidos;
   - podría bajar los ~79 lotes a unos 20 o 30.
2. **Un paquete de arranque armado de antemano en R2.** Son los bloques de `bloques.json` pegados en un solo archivo, que
   sube `subir-r2.mjs`, como `diminutos.bin`. Se baja con 1 a 3 pedidos Range de 32 MB y la página lo reparte en la
   caché del disco. Hay que cuidar que nada se baje dos veces (§174: una versión por archivo). Podría llevar la 1.ª visita
   a unas 20 llamadas. Riesgo: si cambia la semilla, hay que rearmar el paquete.
3. **Un paquete por pista** (la pista, su música, las voces y los karts del paquete de carrera, §169/§176). Bajaría las
   llamadas de cada pista nueva a 1 o 2. Sirve sobre todo en la sala y en las copas.
4. **Dejar el programa en la caché del navegador.** El programa y las semillas ya van `immutable` con su huella. Falta
   que `pipelines.bin`/`bloques.json` y el manifiesto no se pidan en cada visita. El manifiesto es la única llamada fija
   de la 2.ª visita; podría revalidarse con ETag. Gana poco: de 16 llamadas a unas 13 o 14.
5. **La caché de Cloudflare con dominio propio.** No baja las llamadas, pero ahorra el 87 % de las lecturas de R2 y
   sirve más rápido desde Santiago. El dueño tendría que poner un dominio propio al Worker.
6. **Las preguntas previas de CORS.** Ya son 7 por visita: una sola dirección, POST y `Access-Control-Max-Age` de 86.400.
   Queda poco que ganar.
7. **El token.** Ya se verifica una vez por visita: no hace falta nada.

**Cómo comprobar cualquiera de estas mejoras:**

- **Bancos y pruebas:** los bancos `lote`, `disco`, `paquete-carrera` y `descargas`, `prueba-subir-r2.mjs`,
  `node --test colabtex/tests/mkw-worker.test.cjs`, `prueba-experiencia`, `prueba-sala --rapida` y
  `medir-carrera-entera` (0 pedidos con la carrera andando).
- **El antes y el después:** con la tanda de arriba, y la cuenta de jugadores por día.

**Lo que publica el dueño:** el Worker, R2 y Firebase siempre los publica él a mano. Para estas ideas serían:

- el `worker.js` nuevo;
- los paquetes nuevos en R2, con `subir-r2.mjs`;
- si elige la idea 5, el dominio propio del Worker.
