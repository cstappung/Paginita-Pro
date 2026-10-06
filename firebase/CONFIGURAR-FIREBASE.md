# Configuración de Firebase para ColabTeX

Pasos en la [consola de Firebase](https://console.firebase.google.com/project/mi-pagina-pro)
(una sola vez). El inicio de sesión con Google ya está habilitado.

> **IMPORTANTE:** cada vez que cambie un archivo de reglas en esta carpeta
> (`database.rules.json` o `storage.rules`) hay que volver a pegarlo y
> **Publicar** en la consola — el deploy en GitHub Pages NO actualiza las
> reglas de Firebase.

## 0. Seguridad: lo que hay que hacer antes de abrir el sitio a más gente

La configuración de `colabtex/src/firebase.js` (la `apiKey` incluida) es
**pública por diseño**: va dentro de cada página y no se puede esconder, ni
siquiera haciendo privado el repositorio. Lo que protege los datos son las
**reglas** (este directorio) y unos ajustes de la consola. Lista de comprobación:

1. **Publicar las dos reglas otra vez** (`database.rules.json` en Realtime
   Database → Reglas y `storage.rules` en Storage → Reglas). La versión de
   octubre de 2026 cierra:
   - **Enlaces que daban rol de dueño.** Un editor podía fabricar un enlace
     con rol `owner`, entrar con él y quedarse con el proyecto. Ahora un
     enlace solo puede dar `edit` o `view`.
   - **El correo de todo el mundo.** `users/<uid>` era legible por cualquiera
     con sesión, y los uid de los demás están a la vista en cualquier sala de
     juegos. Ahora cada registro es privado y solo `users/<uid>/perfil` (apodo,
     foto, color, marco, bio) es público, con cada campo validado. ColabTeX y
     ColabDraw ya no guardan el correo, y borran el que había al iniciar
     sesión.
   - **Código metido en un color o una foto.** El color y la foto de un perfil
     o de una ficha de partida se pintan dentro de HTML. Las reglas solo
     aceptan `#rrggbb` y URLs `https://` (o una foto subida como imagen JPEG,
     PNG o WebP), y la web limpia además lo que lee (`juegos/sano.js`), lo que
     cubre los datos viejos.
   - **Informes.** Cualquiera podía borrar o reescribir los errores y marcar
     como resuelto lo de otros. Ahora un error se crea y se cuenta, pero solo
     un administrador lo borra. El estado de una sugerencia lo cambia quien la
     escribió o un administrador.
   - **Storage.** Cada archivo recuerda quién lo subió y solo esa persona lo
     reemplaza o lo borra. No se aceptan HTML ni JavaScript, que servidos desde
     un dominio de Google serían una página falsa gratis. Los archivos de antes
     siguen como estaban. Si alguien del proyecto vuelve a exportar una figura
     que subió otra persona, se guarda dentro de la base (si mide ≤ 3 MB). Si
     es más grande, la web pide subirla con otro nombre.
2. **Nombrarte administrador** (opcional, solo para Informes). Tu uid sale en
   **Authentication → Users**, columna *User UID*. En **Realtime Database →
   Datos**, crea en la raíz `admins/<tu uid>` = `true` (booleano, no texto).
   Con eso ves ✕ y ✓ en **Informes** y el escudo 🛡️ de **Juegos**, que abre
   el panel de administración (`juegos.html#admin`: récords por revisar con su
   repetición, auditoría, monedas y suspensiones). Nadie puede escribir ese
   nodo desde la web; solo tú, en la consola. Sin él todo funciona igual, pero
   nadie puede borrar errores del informe ni administrar Juegos.
3. **Restringir la API key por dominio.** [Google Cloud → APIs y servicios →
   Credenciales](https://console.cloud.google.com/apis/credentials?project=mi-pagina-pro)
   → la clave *Browser key (auto created by Firebase)* → **Restricciones de
   aplicaciones: Sitios web** y añade `https://www.paginita-pro.cl/*`, `https://paginita-pro.cl/*`,
   `https://<tu-usuario>.github.io/*`,
   `http://localhost:8123/*` y `https://mi-pagina-pro.firebaseapp.com/*`
   (lo usa el inicio de sesión). No impide que alguien use la clave desde un
   script, pero sí desde otra web.
4. **Dominios autorizados** (Authentication → Settings): deja solo los tuyos
   (ver la sección 3).
5. **Alertas de gasto.** Si el proyecto está en el plan Blaze, en Google Cloud
   → Facturación → **Presupuestos y alertas**, pon un presupuesto bajo (p. ej.
   5 USD) con aviso por correo. Un abuso se nota primero en la factura.
6. **App Check (recomendado).** Hace que la base y Storage solo atiendan a
   peticiones de tu página en un navegador real, no de un script que copió la
   configuración.
   1. Crea la clave en <https://www.google.com/recaptcha/admin/create>:
      tipo **reCAPTCHA v3** (basado en puntuación, sin casillas) y como
      dominios `paginita-pro.cl`, `www.paginita-pro.cl` y
      `cstappung.github.io` (localhost no hace falta: usa el token de
      depuración del paso 3). Google te da dos claves: la *de sitio*
      (pública) y la *secreta*.
   2. Consola de Firebase → **App Check** → **Apps** → la app web →
      **reCAPTCHA** → pega la clave **secreta** y guarda. No pulses
      «Aplicar» todavía (paso 4).
   3. Pega la clave **de sitio** en `APP_CHECK_SITE_KEY`, en
      `colabtex/src/firebase.js`, y ejecuta `npm run build` en `colabtex/`.
      Publica. Con eso todas las apps del sitio (Juegos, ColabTeX,
      ColabDraw, Informes) mandan su sello: comparten ese único archivo.
   4. Para la vista previa local, abre `http://localhost:8123`. La consola
      del navegador imprime un *debug token*: añádelo en App Check →
      **Administrar tokens de depuración**.
   5. Mira unos días las métricas de App Check (cuántas peticiones vienen
      verificadas). Cuando casi todas lo estén, pulsa **Aplicar** en Realtime
      Database y en Storage. Si lo aplicas antes de publicar el sitio con la
      clave, la web se queda sin base.
7. **Si alguien usa el webhook de Discord para mandar spam**, bórralo en Discord, crea otro y
   cambia `discord/webhook`. No hace falta tocar el código.

Lo que las reglas **no** pueden impedir sin un servidor propio, dicho claro:
un jugador con la consola abierta puede declararse ganador de una partida en
la que está (`partidas/<pid>/fin`) y así sumar a su clasificación; cualquiera
con sesión puede llenar el chat de una sala o mandar muchas sugerencias (el
chat general, al menos, solo deja un mensaje cada 20 s por cuenta);
cualquiera con sesión puede leer el webhook de Discord (a propósito, para que
se anuncie la sala de cualquiera) y mandar spam al canal; y el
elenco de Clue (`clueElenco`, nombres y fotos de personas reales) lo puede
leer cualquiera con sesión, porque todos los jugadores de una sala tienen que
ver los mismos personajes. Si eso último te preocupa, usa fotos que no sean
de cara.

Y en PRODROP: las reglas comprueban el precio y la hora de cada sobre, que
una oferta tenga un solo comprador y que un intercambio lo acepte quien lo
recibe, pero no pueden sumar lo que alguien ganó. Por eso la web no se fía
de lo escrito: un gasto (sobre, graduación o compra en el mercado) solo vale
si lo ganado alcanzaba para él. Uno sin fondos escrito a mano no cuenta, lo
que compraba no existe (la carta se queda con quien la vendía) y esa cuenta
queda parada hasta ganar lo que falta, así que el saldo nunca baja de cero.
Las imágenes de las cartas son personas reales
y están en el repositorio público, como cualquier archivo del sitio.

## 1. Reglas de Realtime Database (IMPORTANTE)

> **Re-roll de cartas (octubre de 2026):** cambiar diez cartas por una de
> la rareza siguiente escribe en `cartas/r`, y graduar la carta que sale
> necesita la regla de `cartas/g` nueva. Hasta volver a publicar las reglas,
> el re-roll falla con un aviso.

> **Salas dormidas (octubre de 2026):** una sala de juego en la que nadie
> juega durante 6 horas se cierra sola (`fin.motivo = "inactiva"`). Cada
> jugada apunta la hora en `partidas/<pid>/toque`, y la regla de `fin` deja
> que cualquiera con sesión cierre una sala con 6 horas sin `toque`. Hasta
> volver a publicar las reglas solo la cierran sus propios jugadores al
> abrirla, y las salas viejas que nadie abre se quedan en el vestíbulo
> (aunque ya no se ofrecen en «Salas abiertas»).

> **Más monedas (octubre de 2026):** las partidas del club que pagan viven
> en `clubJugadas` y los premios por quitarle un podio a alguien en
> `podios`. Hasta volver a publicar las reglas, esas monedas no se suman
> (todo lo demás sigue igual).

> **Mercado de cartas (octubre de 2026):** las ventas e intercambios viven
> en un nodo nuevo, `mercado`, y el sobre gratis cada 6 horas en
> `cartas/gratis`. Hasta volver a publicar las reglas, vender, comprar a
> otros, intercambiar y el sobre gratis fallan con un aviso.

> **PRODROP (octubre de 2026):** los sobres y las graduaciones viven en un
> nodo nuevo, `cartas`, y las cartas exhibidas en `users/<uid>/perfil/cartas`.
> Hasta volver a publicar las reglas, comprar un sobre falla y el abridor
> dice que faltan las reglas. La regla de `cartas/s` lleva escrita la fecha
> en que termina el precio de lanzamiento (50 hasta el 4 de octubre, luego 80): si se cambia en
> `juegos/prodrop/motor.js` (`PRECIO.promoHasta`), hay que cambiarla también
> en la regla y volver a publicar.

> **Monedas (octubre de 2026):** la racha de días jugando vive en un nodo
> nuevo, `diario`. Hasta volver a publicar las reglas, las monedas se ven
> igual (salen de partidas, récords y logros), pero los días seguidos no
> suman.

> **Sopa de letras (octubre de 2026):** sus clasificaciones (`club-sopa-…`)
> son categorías nuevas de `soloRanks`. Hasta volver a publicar las reglas, el
> juego funciona igual, pero los récords se quedan en el dispositivo.

> **Electrodle (octubre de 2026):** `club-electro-racha` y
> `club-electro-puntos` son categorías nuevas de `soloRanks` (los puntos, con
> tope de 1 000 000 en vez de 100 000). Hasta volver a publicar las reglas, el
> juego funciona igual, pero los récords se quedan en el dispositivo y se
> sincronizan solos la próxima vez que se abra después de publicarlas.

> **Frontera Batalla (octubre de 2026):** `club-frontera-…` son categorías
> nuevas de `soloRanks` y `frontera` un juego nuevo de `clubJugadas`. Hasta
> volver a publicar las reglas se juega igual, pero las rachas no llegan a la
> clasificación ni pagan las monedas por combate.

> **Sudoku Arcade (octubre de 2026):** `club-sudoku-racha`,
> `club-sudoku-arcade` y `club-sudoku-facil|medio|dificil|experto` son
> categorías nuevas de `soloRanks` (el arcade, con tope de 1 000 000; el
> clásico, con los puntos fijos en 1 porque compite el tiempo) y `sudoku` un
> juego nuevo de `clubJugadas`. Hasta volver a publicar las reglas se juega
> igual, pero los récords se quedan en el dispositivo (se sincronizan solos
> después de publicarlas) y las partidas no pagan monedas.

> **FANAL (octubre de 2026):** `club-fanal-travesia`, `club-fanal-sinfin`
> (puntos, con tope de 1 000 000) y `club-fanal-jornadas` (la jornada más
> lejana completada) son categorías nuevas de `soloRanks`, y `fanal` un juego
> nuevo de `clubJugadas`. Hasta volver a publicar las reglas se juega igual,
> pero los récords se quedan en el dispositivo (se sincronizan solos después
> de publicarlas) y las partidas no pagan monedas.

> **Atasco (octubre de 2026):** `club-atasco-estrellas` (las estrellas
> juntadas en todos los niveles, con el tope común de 100 000) es una
> categoría nueva de `soloRanks`, y `atasco` un juego nuevo de
> `clubJugadas`. El progreso de cada nivel va en `users/<uid>/club/atasco`,
> que ya era de su dueño, así que eso no necesita nada. Hasta volver a
> publicar las reglas se juega igual, pero las estrellas no entran en la
> clasificación (se mandan solas después de publicarlas) y no pagan monedas.

> **ALETEO (octubre de 2026):** `club-aleteo-vuelo` (los tubos del mejor
> vuelo, con tope de 100 000) es una categoría nueva de `soloRanks`, y
> `aleteo` un juego nuevo de `clubJugadas`. El progreso va en
> `users/<uid>/club/aleteo`, que ya era de su dueño. Hasta volver a publicar
> las reglas se juega igual, pero los vuelos no entran en la clasificación y
> no pagan monedas.

> **Metro Rush (octubre de 2026):** `club-metrorush-carrera` (los puntos de la
> mejor carrera, con tope de 1 000 000 000, porque en el juego se llega a
> millones) y `club-metrorush-distancia` (los metros de la carrera más larga,
> con tope de 1 000 000) son categorías nuevas de `soloRanks`, y `metrorush`
> un juego nuevo de `clubJugadas`. Hay que volver a publicar las reglas:
> hasta entonces se juega igual, pero los récords se quedan en el
> dispositivo (se sincronizan solos después de publicarlas) y las carreras
> no pagan monedas.

Tu base de datos está ahora en **modo de prueba** (abierta a cualquiera).
Antes de publicar el sitio:

1. Consola → **Realtime Database** → pestaña **Reglas**.
2. Pega el contenido completo de [`database.rules.json`](database.rules.json).
3. **Publicar**.

Qué garantizan estas reglas:
- Solo usuarios autenticados acceden a algo.
- Solo los miembros de un proyecto pueden leerlo; solo owner/editores escriben.
- Los de "solo lectura" no pueden modificar el documento (se valida en el servidor de Firebase, no solo en la interfaz).
- Unirse por enlace exige un token válido de ese proyecto (`tokenIndex`).
- Los lectores no pueden ver el token de edición.
- Un enlace solo da `edit` o `view`, nunca `owner`.
- `users/<uid>` es privado salvo `users/<uid>/perfil`.

### ⚠ Si vienes de una versión anterior: los informes

La página **Informes** (errores recogidos, fallos y sugerencias) usa dos nodos
nuevos, `errors` y `feedback`, que **no existían** en las reglas de antes.
Mientras no vuelvas a pegar y publicar `database.rules.json`:

- la página de informes se abre pero sale vacía, con un aviso amarillo
  explicando justo esto;
- el botón ⚑ deja escribir el reporte pero al enviarlo falla, y ofrece
  descargarlo a un archivo para no perder lo escrito;
- los errores se siguen guardando en el navegador de cada persona.

O sea, no se rompe nada — simplemente no se comparte hasta que publiques las
reglas. Lo que garantizan una vez publicadas:

- cualquiera con sesión ve el informe entero (es del equipo, no de un proyecto);
- nadie puede firmar un reporte con el `uid` de otra persona;
- solo quien escribió un reporte puede editarlo o borrarlo, pero **cualquiera
  puede marcarlo como resuelto**;
- los textos tienen tope de tamaño, para que un error en bucle no llene la base.

### ⚠ Si vienes de una versión anterior: los juegos

La página **Juegos** usa otros tres nodos nuevos, `partidas`, `misPartidas` y
`ranks`, y le pasa exactamente lo mismo: mientras no publiques de nuevo
`database.rules.json`, el vestíbulo se abre con un aviso amarillo que nombra
esta causa y no se puede crear ni entrar en ninguna partida.

Lo que garantizan una vez publicadas:

- cualquiera con sesión lee las partidas — y puede, porque lo que se esconde
  en el escondite y la carta que se juega en cartas **no viajan en claro**:
  viaja su huella (SHA-256 con sal) y solo se revela cuando ya no sirve de
  nada. Con las reglas no habría bastado: leer la partida es justo lo que hace
  falta para jugarla;
- una jugada **se escribe una vez y no se reescribe** (`!data.exists()`), así
  que nadie vuelve atrás a cambiar la carta que jugó, y solo la firma quien la
  juega (`uid === auth.uid`);
- solo se entra en una sala que sigue en `esperando`, que es lo que impide que
  un tercero se meta en una partida empezada;
- la sala la borra su anfitrión y solo mientras no haya terminado;
- una fila de la clasificación solo la escribe su dueño, solo puede subir de
  una partida en una, y esa partida tiene que existir, haber terminado, ser de
  ese juego y tenerle a él dentro. Es lo que impide anotarse cien victorias a
  mano desde la consola del navegador.

### ⚠ Si publicaste las reglas antes de que existiera Reversi

Este es el caso que se lee como «el juego nuevo está roto». La regla que
valida el campo `juego` lleva **la lista de los juegos que existían el día
que copiaste el archivo**:

```
"juego": { ".validate": "newData.val() === 'escondite' || … || newData.val() === 'reversi'" }
```

Si tu copia publicada es anterior, `'reversi'` no está en esa lista y la base
**rechaza la sala al crearla**, con un `PERMISSION_DENIED` seco que no dice
nada más. Los otros tres juegos siguen funcionando, que es lo que despista.
Lo mismo vale para `misPartidas`, que es donde cada quien guarda la semilla de
su mano de cartas: sin esa regla la mano privada no se puede guardar.

El arreglo es el de siempre — volver a pegar `firebase/database.rules.json`
entero y **Publicar** — y no hay que tocar nada más. Desde la propia página
de juegos, cuando la base rechaza algo sale un cartel que lo explica y trae el
archivo al portapapeles con un botón.

### ⚠ Circuit Breakers (worms) pide publicar otra vez

Es el mismo caso que Reversi, dos veces: `'worms'` tiene que estar en la lista
del campo `juego`, y además hay un nodo nuevo, `vivo`, por donde viaja en
directo lo que hace quien tiene el turno (solo lo escriben los jugadores de
esa sala, y solo mientras la partida no termina). Sin publicar, la sala de
Circuit Breakers no se puede crear. El arreglo es el de siempre: pegar
`firebase/database.rules.json` entero y **Publicar** — o usar el botón
**Copiar las reglas** del cartel que sale en la página de juegos.

### ⚠ La voz de Yemas después de la partida pide publicar otra vez

`vivo/<pid>/voz` tiene ahora una regla propia que deja escribir a los
jugadores de la sala también cuando la partida ya terminó. Así el chat de
voz sigue funcionando en la pantalla del final y hasta que cada uno sale de
la sala. Sin publicar, las conexiones que ya estaban siguen hablando, pero
nadie puede entrar ni reconectarse a la voz después del fin.

### ⚠ Yemas pide publicar otra vez

`'yemas'` tiene que estar en la lista del campo `juego` y en la de `logros`.
El directo de cada huevo va por el nodo `vivo` que ya existe (`vivo/<pid>/y`),
así que no hay nodo nuevo. Sin publicar, la sala de Yemas no se puede crear.
El arreglo es el de siempre: pegar `firebase/database.rules.json` entero y
**Publicar**, o usar el botón **Copiar las reglas** del cartel de la página
de juegos.

### ⚠ El ajedrez pide publicar otra vez

`'ajedrez'` tiene que estar en la lista del campo `juego` y en la de `logros`.
No hay nodo nuevo: las jugadas van por `jugadas` como en Reversi, y el color
y el ritmo de la sala (`color`, `ritmo`) entran por `$otro`. Con el reloj se
añadió además una regla a `jugadas/$n/at`: en las salas de ajedrez la hora de
cada jugada tiene que estar a pocos segundos de la del servidor (de 8 s antes
a 3 s después). Sin publicarla el reloj funciona igual, pero esa hora no se
comprueba. Sin publicar, la sala de
ajedrez no se puede crear. El arreglo es el de siempre: pegar
`firebase/database.rules.json` entero y **Publicar**, o usar el botón
**Copiar las reglas** del cartel de la página de juegos.

### ⚠ Pokémon pide publicar otra vez

`'pokemon'` tiene que estar en la lista del campo `juego` y en la de
`logros`. No hay nodo nuevo: las elecciones van por `jugadas` (promesa y
revelación, ver `colabtex/src/juegos/pokemon/motor-pk.js`), el formato de la
sala entra como `formato` por `$otro`, y los equipos de cada uno viven en
`users/<uid>/pokemon`, que ya es solo de su dueño. Sin publicar, la sala de
Pokémon no se puede crear. El arreglo es el de siempre: pegar
`firebase/database.rules.json` entero y **Publicar**, o usar el botón
**Copiar las reglas** del cartel de la página de juegos.

### ⚠ Clue pide publicar otra vez, y un elenco a mano

`'clue'` tiene que estar en la lista del campo `juego` y en la de `logros`, y
hay un nodo nuevo, `clueElenco`, que se lee con sesión iniciada y no se
escribe desde la web. Sin publicar, la sala de Clue no se puede crear. El
arreglo es el de siempre: pegar `firebase/database.rules.json` entero y
**Publicar**, o usar el botón **Copiar las reglas** del cartel de la página
de juegos.

`clueElenco` son los personajes que se eligen al empezar: nombres y fotos de
gente de verdad, y por eso **no están en este repositorio**, que es público.
Se cargan una vez a mano en Realtime Database: crear el hijo `clueElenco`
en la raíz, abrirlo y, **ya dentro de él**, usar ⋮ → **Importar JSON** con el
archivo que te pasen. Ojo: importar sobre la raíz reemplazaría la base
entera. El archivo tiene esta forma:

```json
{ "apellido": { "n": "Nombre Apellido", "c": "Apellido", "f": "data:image/jpeg;base64,..." } }
```

La clave es el id del personaje (minúsculas, números y guiones, hasta 24),
`n` el nombre, `c` el corto y `f` una foto de unos 160×160 en data URL
(unos 8 KB). Hacen falta seis o más. Mientras no esté, el juego usa su
elenco inventado, así que se puede jugar igual.

### Consumo de Yemas

Ojo con el consumo: cada jugador escribe su posición unas doce veces por
segundo y recibe la de los demás. Con seis en la sala son del orden de
10 KB/s de bajada por persona, bastante más que cualquier otro juego. En el
plan gratuito (10 GB al mes) alcanza para varias decenas de horas de partidas
al mes; si se juega mucho conviene mirar el uso en la consola.

### ⚠ El tope de descarga pide publicar otra vez

El plan gratuito trae unos 360 MB de descarga al día para todo el sitio.
Dos cosas lo protegen:

- **Las reglas ya no dejan bajar colecciones enteras.** `partidas` solo se
  puede leer con la consulta del vestíbulo (`orderByChild('estado')` +
  `equalTo('esperando')`) o sala por sala; `vivo`, `chat` y `soloPruebas`
  solo por su clave. Antes, una línea en la consola (`get(ref(db,
  'partidas'))`) bajaba el registro de jugadas de todas las partidas de la
  historia. **Esto es lo único que el servidor hace cumplir**, y hay que
  publicar las reglas para que valga.
- **Cada jugador tiene un tope de 80 MB al día** (`colabtex/src/consumo.js`).
  Juegos mide lo que baja por el WebSocket de la base, lo suma entre
  pestañas y aparatos de la misma cuenta (`users/<uid>/consumo`, que no
  necesita reglas nuevas) y, al llegar al tope, corta la conexión y tapa la
  página hasta la medianoche de Chile. Pasar de 40 MB en el día, 15 MB en
  cinco minutos en una pestaña, o llegar al tope deja un aviso en
  `sospechas/<uid>` con `c: "red-descarga"` (`p` = MB del día, `t` = MB de la
  ráfaga, `d` = `dia` / `rafaga` / `tope`). Los números están en `LIMITES`.
  Este tope corre en el navegador: quien reescribe el cliente o usa la API
  REST con su token lo salta. Frena el consumo descontrolado normal y deja
  el rastro; para lo demás están las reglas de arriba, App Check
  (sección 0) y vetar la cuenta (`vetados/<uid>`).

### ⚠ Chain Reaction (cadena) pide publicar otra vez

El mismo caso otra vez: `'cadena'` tiene que estar en la lista del campo
`juego`, y la sala guarda además el tamaño del tablero en un campo nuevo,
`malla` (solo admite `chica`, `clasica` o `grande`). Con las reglas viejas la
sala de Chain Reaction no se puede crear. El arreglo es el de siempre: pegar
`firebase/database.rules.json` entero y **Publicar**, o usar el botón
**Copiar las reglas** del cartel de la página de juegos.

### ⚠ El chat de sala y «en juego ahora» piden publicar otra vez

Dos nodos nuevos, los dos fuera de `partidas/`:

- `chat/<pid>` — la charla de cada sala. La leen todos los que tienen sesión y
  escribe cualquiera, jugador o espectador, pero **solo con su propio uid**,
  **una vez** por mensaje (no se editan) y solo mientras la partida existe;
  300 caracteres como mucho.
- `enCurso/<pid>` — el cartel con el que una partida empezada aparece en el
  vestíbulo para que otros la miren. Lo escriben solo sus jugadores y solo
  mientras no termina; lo puede borrar cualquiera cuando la partida ya acabó o
  ya no existe.

La votación para expulsar a alguien **no necesita nada nuevo**: los votos son
jugadas como cualquier otra, y viajan por `partidas/<pid>/jugadas`. Sin
publicar, las partidas se juegan igual, pero el chat no manda nada y el
vestíbulo no enseña las partidas en juego. El arreglo es el de siempre: pegar
`firebase/database.rules.json` entero y **Publicar**.

### ⚠ Catan pide publicar otra vez

Solo cambia la lista del campo `juego`, que ahora lleva `'catan'`. Las
opciones de la sala (`exp`, `baraja`, `amable`, `puerto`, `largo`) no son
`modo` a propósito: van por la regla genérica de los campos de la partida y
no necesitan nada. Sin publicar, la sala de Catan no se puede crear. El
arreglo es el de siempre: pegar `firebase/database.rules.json` entero y
**Publicar**, o usar el botón **Copiar las reglas** del cartel de la página de
juegos.

### ⚠ El antitrampas del Solo Club pide publicar otra vez

`soloRanks` ahora exige que cada fila tenga su prueba en `soloPruebas`, y
hay cuatro nodos nuevos: `rachasClub` (la racha diaria de verdad de la
Sopa, el Sudoku y Electrodle, que solo sube de a uno por día),
`soloPruebas` (la prueba de cada récord),
`sospechas` (las partidas que el verificador rechazó; solo las leen los
administradores) y `vetados` (cuentas que ya no pueden escribir récords;
solo las escribe un administrador). Ver `docs/antitrampas.md`.

Hasta publicar, los récords se siguen guardando con las reglas viejas,
pero sin prueba que auditar. Para vetar a alguien, en la consola:
`vetados/<uid>` = `{"at": <ms de ahora>, "m": "motivo"}`, y borrar sus filas
de `soloRanks`.

### ⚠ El panel de administración de Juegos pide publicar otra vez

Cuatro nodos nuevos, todos para el panel `juegos.html#admin`
(`colabtex/src/juegos/admin.js`), que solo ve quien está en `admins/<uid>`:

- `revisiones/<cat>/<uid>`: el récord del club que acaba de subir al podio
  (1.º a 3.º). Lo escribe el jugador, y la regla pide que sea su fila de
  verdad; solo lo leen y lo borran los administradores.
- `auditados/<cat>/<uid>` = `{p, ok, m, h?}`: el veredicto de la prueba de
  esa partida, para que ningún administrador la vuelva a bajar. Solo
  administradores.
- `ajustesMonedas/<uid>/<id>` = `{n, m, por, at}`: monedas sumadas o
  restadas a mano. Lo lee cualquiera con sesión (entra en el saldo de todos);
  lo escribe solo un administrador, una vez, y no se borra (para deshacerlo
  se pone otro al revés).
- `suspensiones/<uid>` = `{hasta, m, por, at}`: la suspensión con la
  pantalla de «WASTED». La lee su dueño (y los administradores); la escriben
  y la levantan solo los administradores, hasta un año.

Además, una cuenta **suspendida** ya no puede escribir récords,
partidas del club, podios, rachas, repeticiones ni el chat general (la misma
condición que `vetados`, con la hora de fin). Hasta publicar, el panel avisa
de que faltan las reglas y los jugadores no notan nada.

### ⚠ Los rieles del salón (chat general y mejores partidas) piden publicar otra vez

Tres nodos nuevos, para lo que se ve a los lados del salón en un PC ancho
(`colabtex/src/juegos/rieles.js`):

- `chatGeneral/<id>` — el chat general. Lo lee cualquiera con sesión; cada
  mensaje lo escribe su dueño **una vez**, 200 caracteres como mucho, y una
  cuenta vetada no escribe. Un administrador borra cualquier mensaje, y
  cualquiera con sesión puede borrar los de **más de un día** (el salón barre
  unos pocos al abrirse, para que el nodo no crezca para siempre).
- `chatGeneralUlt/<uid>` — `{at, k}`, el último mensaje de cada cuenta. Se
  escribe en la misma actualización que el mensaje, y la regla exige **20 s
  desde el anterior**: la espera la pone la base, no la página. Solo lo lee
  su dueño.
- `repeticiones/<categoría>/<uid>` — la mejor partida del día de cada cuenta
  en Tetris Maratón, Snake clásico mediano, sortEm de 20 y el buscaminas
  medio, con su prueba antitrampas para que el salón la repita. Solo esas
  cuatro categorías, solo el día de hoy (en Chile), y solo si mejora la que
  ya había; `o` (la clave por la que se ordena) la recalcula la regla.

Sin publicar, el chat dice que espera las reglas y el riel de la izquierda
repite el récord histórico de cada tabla (que ya está en `soloPruebas`). El
arreglo es el de siempre: pegar `firebase/database.rules.json` entero y
**Publicar**.

### Aviso de salas nuevas en Discord (opcional)

Cada sala que se abre desde el vestíbulo puede anunciarse en un canal de
Discord: un mensaje con el juego, quién la abrió, las opciones elegidas y un
botón **Unirse a la sala**. No hace falta bot ni servidor. Es un *webhook*, y
el mensaje lo manda el navegador de quien abre la sala. Las revanchas no se
anuncian, y las salas abiertas desde `localhost` tampoco.

1. En Discord: **Editar canal → Integraciones → Webhooks → Nuevo webhook**.
   Ponle nombre y foto si quieres (el mensaje firma como «Laboratorio ·
   Juegos») y pulsa **Copiar URL del webhook**.
2. Publica las reglas otra vez (pegar `firebase/database.rules.json` entero y
   **Publicar**). Traen un nodo nuevo, `discord`, que pueden leer los que
   tienen sesión (así se anuncia la sala de cualquiera) y que no puede
   escribir nadie desde la web.
3. En **Realtime Database → Datos**, crea a mano, en la raíz:
   - `discord/webhook` = la URL copiada
     (`https://discord.com/api/webhooks/…`).
   - `discord/mencion` (opcional) = `@here`, o `<@&ID_DEL_ROL>` para avisar
     a un rol. Sin este campo el mensaje no llama a nadie.

El mismo webhook anuncia también, a lo grande, cada récord de Mina Club,
Snake Club o Tetris Club que sube a alguien al podio (top 3) de su modalidad.
No necesita configuración aparte.

Para apagarlo, borra `discord/webhook`. Si alguien copia la URL y manda spam,
borra el webhook en Discord, crea otro y cambia el valor. No hace falta
recompilar ni publicar el sitio.

## 2. Reglas de Storage

1. Consola → **Storage** → pestaña **Reglas**.
2. Pega el contenido de [`storage.rules`](storage.rules) y publica.

Nota: en el plan gratuito (Spark), los proyectos creados después de octubre
de 2024 pueden no permitir activar Storage. **No pasa nada**: ColabTeX detecta
el fallo y guarda los archivos binarios (imágenes ≤ 3 MB) dentro de Realtime
Database automáticamente.

## 2b. CORS de Storage (OBLIGATORIO para descargar imágenes/PDF)

Si el sitio vive en un dominio distinto al de Firebase (p. ej.
`cstappung.github.io`), el navegador bloquea las descargas de Storage con un
error **CORS** (`No 'Access-Control-Allow-Origin' header…`). Esto pasa al
compilar un proyecto que usa una imagen o PDF subido a Storage. Hay que
autorizar el dominio en el bucket **una sola vez**:

1. Abre [Cloud Shell](https://console.cloud.google.com/?project=mi-pagina-pro&cloudshell=true)
   (el icono `>_` arriba a la derecha en la consola de Google Cloud). Ya viene
   con `gcloud`/`gsutil` autenticado a tu proyecto.
2. Sube el archivo [`cors.json`](cors.json) de esta carpeta (menú `⋮` → *Upload*
   en Cloud Shell) **o** créalo pegando su contenido con:

   ```
   cat > cors.json <<'EOF'
   [
     {
       "origin": ["https://www.paginita-pro.cl", "https://paginita-pro.cl", "https://cstappung.github.io", "http://localhost:8123", "http://127.0.0.1:8123"],
       "method": ["GET", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Content-Range", "Accept-Ranges", "Content-Length"]
     }
   ]
   EOF
   ```

3. Aplícalo al bucket (ojo: el bucket es `firebasestorage.app`, el que aparece
   en `storageBucket` de la config):

   ```
   gcloud storage buckets update gs://mi-pagina-pro.firebasestorage.app --cors-file=cors.json
   ```

   (Alternativa con la herramienta antigua: `gsutil cors set cors.json gs://mi-pagina-pro.firebasestorage.app`.)

4. Verifica:

   ```
   gcloud storage buckets describe gs://mi-pagina-pro.firebasestorage.app --format="default(cors_config)"
   ```

Recarga la página (Ctrl+Shift+R) y vuelve a compilar: las imágenes/PDF ya se
descargan. Si más adelante cambias de dominio, añádelo a `origin` y repite el
paso 3.

## 3. Dominios autorizados para el login

Consola → **Authentication** → **Settings** → **Authorized domains** → *Add domain*:

- `www.paginita-pro.cl` y `paginita-pro.cl`  ← el dominio propio del sitio
- `TU-USUARIO.github.io`  ← el dominio de GitHub Pages donde publiques

(`localhost` ya viene autorizado, así que la vista previa local funciona sin más.)

## 4. Publicar en GitHub Pages

Desde la carpeta del proyecto (el repo git ya está preparado):

```
git remote add origin https://github.com/TU-USUARIO/NOMBRE-REPO.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: Deploy from a branch →
Branch: main / (root) → Save**. En un par de minutos el sitio queda en
`https://TU-USUARIO.github.io/NOMBRE-REPO/`.

### Dominio propio (www.paginita-pro.cl)

1. **DNS** (donde se administren los DNS del dominio; NIC Chile solo delega a
   unos servidores de nombres): un `CNAME` de `www` → `cstappung.github.io.`, y
   para el dominio desnudo cuatro `A` → `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153` (y si se quiere IPv6, `AAAA` →
   `2606:50c0:8000::153` … `2606:50c0:8003::153`). Con Cloudflare, el registro
   va en «Solo DNS» (nube gris) hasta que GitHub emita el certificado.
2. GitHub → **Settings → Pages → Custom domain**: `www.paginita-pro.cl` →
   *Save*. Eso crea el archivo `CNAME` en la raíz del repo; no hay que
   borrarlo. Cuando el chequeo de DNS pase, marcar **Enforce HTTPS**.
3. Añadir el dominio en los tres sitios que dependen del origen: dominios
   autorizados del login (sección 3), CORS de Storage (sección 2b, paso 3) y la
   restricción de la API key (sección 0, punto 3).

Lo que el navegador guarda por origen (`localStorage`, IndexedDB, la sesión de
Google) no viaja al dominio nuevo: hay que iniciar sesión otra vez, y las
carpetas enlazadas con «Abrir en VS Code» se vuelven a elegir. Lo que vive en
Firebase (proyectos, partidas, monedas, cartas) sigue igual.

Avisos:
- El repo pesa ~220 MB por el motor LaTeX (`vendor/busytex/`). El archivo
  más grande (99.7 MiB) queda justo bajo el límite de 100 MiB de GitHub.
- GitHub Pages en cuentas gratuitas requiere que el repo sea **público**.
