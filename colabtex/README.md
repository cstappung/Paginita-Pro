# ColabTeX — editor LaTeX colaborativo

Editor estilo Overleaf, **100% estático** (se publica en GitHub Pages) con
**Firebase** como backend:

- **Cuentas**: inicio de sesión con Google (Firebase Authentication).
- **Compilación en el navegador del cliente** — pdfTeX compilado a
  WebAssembly (BusyTeX). Ningún servidor compila nada.
- **Colaboración en tiempo real** — Yjs + CodeMirror 6 (cursores remotos,
  presencia) sincronizado a través de **Firebase Realtime Database**
  (proveedor propio: `src/y-rtdb.js`).
- **Proyectos e invitaciones** — metadatos, miembros y roles en Realtime
  Database; enlaces con rol *Puede editar* / *Solo lectura*.
- **Binarios (imágenes…)** — Firebase Storage, con respaldo automático en
  Realtime Database (base64, ≤ 3 MB) si Storage no está disponible.

## Uso local (vista previa)

Doble clic en `Iniciar ColabTeX.cmd` (carpeta raíz), o:

```
cd colabtex
npm start          # servidor estático en http://localhost:8123
```

El login con Google funciona en localhost. Producción: ver
[`../firebase/CONFIGURAR-FIREBASE.md`](../firebase/CONFIGURAR-FIREBASE.md).

## Estructura

```
colabtex/
  src/main.js       Aplicación (login, dashboard, editor, compartir)
  src/firebase.js   Init de Firebase (config del proyecto mi-pagina-pro)
  src/fb-api.js     Capa de datos: proyectos, miembros, tokens, assets
  src/y-rtdb.js     Proveedor Yjs sobre Realtime Database + presencia
  src/latex.js      Motor BusyTeX (worker WASM) + resumen de log
  src/pdfview.js    Visor PDF (pdf.js)
  server/static.js  Servidor estático SOLO para desarrollo local
firebase/           Reglas de seguridad + guía de configuración
vendor/busytex/     Motor pdfTeX WASM + paquetes TeXLive (~217 MB)
colabtex.html       Interfaz
colabtex-app.js     Bundle generado (npm run build)
```

## Desarrollo

```
cd colabtex
npm run build      # re-empaqueta src/ → colabtex-app.js + colabtex-pdf-worker.js
```

## Esquema de datos (Realtime Database)

```
users/<uid>                      perfil (nombre, foto, color)
userProjects/<uid>/<pid>: true   índice de proyectos del usuario
projects/<pid>/meta              título, propietario, fechas, mainFile (archivo principal)
projects/<pid>/members/<uid>     {name, role: owner|edit|view, viaToken}
projects/<pid>/tokens            {edit, view}   (solo visibles para editores)
projects/<pid>/invites/<token>   invitaciones por correo
projects/<pid>/doc/snapshot      estado Yjs consolidado (base64)
projects/<pid>/doc/updates/<k>   cambios incrementales (se compactan cada ~80)
                                 (el Y.Doc guarda dos mapas: "files" ruta→texto
                                  y "folders" ruta→true para carpetas vacías;
                                  las rutas pueden llevar subcarpetas: cap1/intro.tex)
projects/<pid>/assetsIndex/<k>   índice de binarios (storage o base64)
tokenIndex/<token>               {pid, role} — unirse por enlace
presence/<pid>/<clientID>        cursores y presencia (se limpia al desconectar)
```

## Notas

- Paquetes LaTeX: texlive-basic + latex-recommended + latex-extra +
  science (siunitx) + fonts-recommended + `spanish.ldf` (babel) inyectado.
- Primera compilación descarga el motor (~150 MB, queda en caché);
  recompilar ≈ 4-5 s.
- Con `[T1]{fontenc}` usar `\usepackage{lmodern}` (no hay fuentes EC
  bitmap en WASM); la plantilla ya lo hace.
- `migracion-proyectos-locales/` contiene los .tex exportados de la
  versión anterior (cuando los proyectos vivían en el disco local).
