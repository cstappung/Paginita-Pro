# Publicar Mario Kart Wii en el sitio (lo hace el dueño)

Lo que hay que hacer para que un amigo entre a paginita-pro.cl → Juegos → Mario Kart Wii y juegue. Todo lo de este
PC (la lista de archivos, el código del Worker y sus pruebas, la subida) está listo y probado aquí (bitácora §65). El
**programa final** se rearma justo antes de subir (paso 0), porque el código cambió mucho desde §65. Lo que sigue
después lo hace el dueño, porque toca sus cuentas: **Cloudflare (R2 y el Worker) y Firebase**.

El juego sale **para PC** (Chrome o Edge de escritorio). Los celulares quedan para un big update lejano (decisión del
dueño, 2026-10-19).

## 0. El programa final (lo hace Claude, cuando digas «publiquemos»)

Con el código del momento, sin nada a medio hacer en la carpeta:

```bash
python herramientas/compilar-web.py --modo navegador --final      # sin nombres de funciones + mkw.wasm.br (~16 MB)
node web/navegador/guion.mjs "<pasos de una carrera>" --semilla     # 3 veces, copas distintas (como en §65)
node herramientas/correr-todo.mjs                                   # todas las pruebas (~25 min)
```

Las semillas (`pipelines.bin`, `bloques.json`) se rehacen si cambió cómo se dibuja o qué lee el juego; si no, sirven
las de antes. Recién con todo bien se pasa al paso 2.

## Qué va dónde

| Qué | Dónde | ¿Público? |
|---|---|---|
| La página del juego, la sala, las reglas del juego (`juegos/mkw/`, `juegos-app.js`, `juegos.html`) | GitHub Pages (el repo del sitio) | sí: no tienen nada del juego |
| El programa (`mkw.js`, `mkw.wasm.br`), el disco extraído, Retro Rewind, las semillas y las imágenes (también la del menú de inicio «JloKart Wii», que muestra a una persona real) | El R2 del dueño, prefijo `mkw/` del mismo bucket que el disco de BT3 | **no**: solo los entrega el Worker, y solo a la lista de amigos |
| Quién puede jugar | La variable `AMIGOS` del Worker (la misma de BT3) | no |
| El VR y los récords de cada uno | Firebase (`mkw/vr`, `mkw/records`) | lo lee el sitio |

Como en BT3: el Worker revisa en cada pedido el token de Firebase de quien juega (firma de Google, proyecto, vigencia)
y que esté en `AMIGOS`. Sin eso contesta 401 (sin sesión) o 403 (no es amigo). El bucket **nunca** se hace público
(nada de la dirección `r2.dev`): solo el Worker lo lee.

## 1. Las llaves de R2 (una vez)

Cloudflare → **R2** → **Manage R2 API Tokens** → **Create API token**:
- Permisos: **Object Read & Write**.
- Alcance: **solo el bucket** del disco de BT3 (el del binding `DISCO` del Worker; su nombre está en R2 → Overview).
- Al crearlo, Cloudflare muestra una sola vez el **Access Key ID** y el **Secret Access Key**. El **Account ID** está en
  la misma página de R2 (a la derecha). Guárdalos donde guardas tus claves, **nunca en un archivo de esta carpeta**.

## 2. Subir lo privado (desde este PC)

En PowerShell, en `C:\Users\zilon\Desktop\Gaming\MKW RETRO`:

```powershell
$env:R2_CUENTA="<Account ID>"; $env:R2_ID="<Access Key ID>"; $env:R2_SECRETO="<Secret Access Key>"; $env:R2_BUCKET="<nombre del bucket>"
node herramientas/subir-r2.mjs              # revisar: arma la lista (build/web/publicar/lista.tsv), sin red
node herramientas/subir-r2.mjs --subir      # sube lo que falta (se puede cortar y repetir: salta lo que ya está igual)
node herramientas/subir-r2.mjs --comprobar  # revisa en R2 cada archivo (tamaño y huella SHA-256)
```

- La imagen del menú de inicio (`build/web/navegador/imagenes/inicio/jlokart.webp`, 264 KB) va en la misma subida: si
  falta, el juego abre sin ese menú. Se rehace con `python -I herramientas/preparar-inicio.py <imagen original>`.
- Son **~6.100 archivos, ~4,9 GB**. A 20 Mbit/s de subida tarda ~35 min; a 10 Mbit/s, ~70 min.
- Cada archivo va con su huella SHA-256: R2 la recalcula y **rechaza** un archivo que llegó distinto.
- `mkw/version.json` se sube **al final**: hasta que está todo arriba, quien juegue sigue con la versión anterior.
- Espacio: el plan gratis de R2 da **10 GB** al mes. Con la ISO de BT3 + Mario Kart (~4,9 GB) mira el uso en
  R2 → el bucket → Metrics. Pasado el límite cuesta ~0,015 USD por GB al mes.
- Después de una actualización (programa nuevo o Retro Rewind nuevo): de nuevo `--subir` y `--comprobar`;
  `--sobrantes` muestra lo viejo que quedó en `mkw/` (no borra nada: se borra a mano si se quiere).

## 3. El Worker (el mismo de BT3)

Cloudflare → **Workers & Pages** → el Worker del disco de BT3 → **Edit code** → reemplazar todo por el contenido de
`terceros/Paginita-Pro/juegos/bt3/fuente/disco/worker.js` (en el sitio: `juegos/bt3/fuente/disco/worker.js`) →
**Deploy**.

- No hay variables nuevas: usa las mismas `AMIGOS`, `ORIGENES`, `CLAVE_SUBIDA` y el mismo binding `DISCO`.
- BT3 sigue igual (sus 7 pruebas pasan con este archivo). Lo nuevo son las rutas `/mkw/…` (6 pruebas más).
- Para que los pedazos del disco queden en el caché de Cloudflare cerca de Chile, el Worker necesita un **dominio
  propio** (Settings → Domains & Routes → Custom domain); en `*.workers.dev` funciona igual, pero todo sale de R2.

## 4. La dirección (en el sitio)

`juegos/mkw/privado.json` dice de dónde saca la sala el juego: la dirección del Worker **con `/mkw` al final**:

```json
{ "url": "https://bt3-disco.rayoluxd1.workers.dev/mkw" }
```

Es la de `juegos/bt3/disco-privado.json` (el Worker de BT3) más `/mkw`. No es secreta (sin token no sirve). Se pone
**después** de los pasos 2 y 3: vacía, la sala dice que el juego todavía no está publicado; puesta antes de tiempo, el
Worker viejo contestaría 404 y la sala mostraría un error. En esta carpeta es `privado.json` (lo copia
`subir-kit.sh` a `juegos/mkw/privado.json`). Con `*.workers.dev` no hay caché de Cloudflare (paso 3): cada pedazo del
disco viaja desde R2 (fuera de Sudamérica), ~150 ms más por pedido; un dominio propio lo mejora.

## 5. Las reglas de Firebase

Firebase → Realtime Database → **Rules** → pegar `firebase/database.rules.json` entero → **Publish**. Agregan el nodo
`mkw` (VR y récords: cada uno escribe solo lo suyo), `'mkw'` en la lista de juegos y de logros, y el tope de 12 por sala.
Sin publicarlas, la sala de Mario Kart no se puede crear.

Firebase → Storage → **Rules** → pegar `firebase/storage.rules` entero → **Publish**. Agrega
`mkw/{uid}/partidas.mkwp`: las partidas de cada uno en la nube (solo su dueño las lee y escribe, hasta 8 MB). Sin
publicarla el juego anda igual, pero las partidas quedan solo en el navegador donde se jugó.

## 6. Que llegue al sitio

El trabajo está en la rama `claude/loving-planck-9k2yam` del sitio (commits locales, sin push ni PR, como pediste).
Cuando digas, se sube y se junta con `main` (GitHub Pages publica `main`).

## 7. Probar

**Antes, en este PC (sin publicar nada):** doble clic en `jugar.bat` abre esta misma página de Juegos, con Firebase y
cuentas de mentira y el Worker de verdad, mostrando solo Mario Kart; con 2 o 3 ventanas se prueba la sala como si
fueran varios PC (bitácora §69). La prueba automática del mismo recorrido: `node herramientas/prueba-experiencia.mjs`
(17 puntos: dos cuentas, la sala, la copa, elegir en el juego y la carrera juntos). Lo de abajo es lo mismo, pero ya
en el sitio publicado.

- **Como amigo** (una cuenta de `AMIGOS`): Juegos muestra Mario Kart Wii → abrir una sala (modo copa o playlist) →
  «¡A correr!» → el juego carga (la primera vez baja ~300 MB en total, la mayoría mientras se juega; la segunda casi
  nada). Hasta 4 personas, el resto CPU: el anfitrión elige la copa (o arma la playlist con las sugerencias de los
  demás), cada uno elige personaje y vehículo en el juego y todos largan juntos; al final, la tabla en el vestíbulo.
- **Como amigo, un jugador**: Juegos → «Mario Kart Wii · un jugador» → el menú de inicio «JloKart Wii» (Single Player,
  Multiplayer, Options); Multiplayer → Online lleva a las salas.
- **Como no-amigo**: Mario Kart no aparece en Juegos (ni su «un jugador»: `#solo/mkw` dice «Este juego es privado»); el
  enlace de una sala dice «Sala privada»; pedirle algo al Worker a mano (también la imagen del menú) da 401 (sin sesión)
  o 403.
- **Dos PCs** = dos ventanas del mismo PC, como se probó BT3.

## Límites del plan gratis de Workers

- **100.000 pedidos al día.** Una primera visita son ~2.600 pedidos (incluidas ~200 "preguntas previas" de CORS, una
  por archivo distinto); una segunda visita, muy pocos (el programa queda en la caché del navegador y el disco en la
  de la página). Alcanza para varias decenas de primeras visitas al día.
- **10 ms de procesador por pedido.** La revisión del token (RSA) se hace una vez y se recuerda; cada pedazo del disco
  es solo leer de R2.
