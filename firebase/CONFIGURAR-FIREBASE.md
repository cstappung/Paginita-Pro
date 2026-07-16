# Configuración de Firebase para ColabTeX

Pasos en la [consola de Firebase](https://console.firebase.google.com/project/mi-pagina-pro)
(una sola vez). El inicio de sesión con Google ya está habilitado.

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
