# Configuración de Firebase para ColabTeX

Pasos en la [consola de Firebase](https://console.firebase.google.com/project/mi-pagina-pro)
(una sola vez). El inicio de sesión con Google ya está habilitado.

> **IMPORTANTE:** cada vez que cambie un archivo de reglas en esta carpeta
> (`database.rules.json` o `storage.rules`) hay que volver a pegarlo y
> **Publicar** en la consola — el deploy en GitHub Pages NO actualiza las
> reglas de Firebase.

## 1. Reglas de Realtime Database (IMPORTANTE)

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
       "origin": ["https://cstappung.github.io", "http://localhost:8123", "http://127.0.0.1:8123"],
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

Avisos:
- El repo pesa ~220 MB por el motor LaTeX (`vendor/busytex/`). El archivo
  más grande (99.7 MiB) queda justo bajo el límite de 100 MiB de GitHub.
- GitHub Pages en cuentas gratuitas requiere que el repo sea **público**.
