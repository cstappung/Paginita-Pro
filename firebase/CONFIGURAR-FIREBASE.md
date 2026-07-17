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
