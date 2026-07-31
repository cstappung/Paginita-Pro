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

Esta carpeta es además el **taller de compilación de las dos aplicaciones web**
del sitio (ColabTeX y ColabDraw): es la única con `node_modules`, y duplicarla
solo por Firebase y Yjs costaría unos 200 MB.

```
colabtex/
  src/main.js       Aplicación (login, dashboard, editor, compartir)
  src/draw-main.js  ColabDraw: aplicación de dibujo vectorial (bundle aparte)
  src/draw/         Editor SVG: modelo, lienzo, herramientas, exportación
  src/firebase.js   Init de Firebase (config del proyecto mi-pagina-pro)
  src/fb-api.js     Capa de datos: proyectos, miembros, tokens, assets
  src/y-rtdb.js     Proveedor Yjs sobre Realtime Database + presencia
  src/latex.js      Motor BusyTeX (worker WASM) + resumen de log
  src/pdfview.js    Visor PDF (pdf.js)
  src/asset-preview.js  Vista previa de imágenes y PDF al pulsarlos en el
                    árbol de archivos (ocupa el sitio del editor)
  src/format.js     Negrita, cursiva, subrayado y color del texto
                    seleccionado (botones de la barra y Ctrl+B/I/U)
  src/file-move.js  Renombrar y mover archivos: rutas, validación,
                    reescritura de referencias y arrastrar/soltar
  src/comments.js   Comentarios sobre el texto (hilos anclados con
                    posiciones relativas de Yjs; resalte, burbuja y panel)
  server/static.js  Servidor estático SOLO para desarrollo local
firebase/           Reglas de seguridad + guía de configuración
vendor/busytex/     Motor pdfTeX WASM + paquetes TeXLive (~217 MB)
colabtex.html       Interfaz
colabtex-app.js     Bundle generado (npm run build)
colabdraw.html      Interfaz de ColabDraw
colabdraw-app.js    Bundle generado de ColabDraw
```

## Desarrollo

```
cd colabtex
npm run build      # re-empaqueta las dos aplicaciones + el worker de pdf.js
```

`scripts/stamp-version.js` sella el `?v=…` de **cada** página (tabla `PAGES`)
para que el navegador no sirva un bundle viejo de la caché.

## ColabDraw (editor SVG)

Aplicación hermana, en `colabdraw.html`. Comparte proyecto de Firebase, sesión
de Google (Auth persiste por origen: quien ha entrado en ColabTeX ya está
dentro) y el mismo proveedor de Yjs. Un proyecto de dibujo **es un proyecto
normal** con `meta.kind: "draw"`, así que miembros, roles, enlaces, duplicar y
borrar son el mismo código y **las reglas de seguridad no cambian**.

- **Documento**: `Y.Map "drawings"` de ruta → `Y.XmlFragment`, y dentro un
  `<svg>` que es el archivo (tamaño, `<defs>` y capas `<g data-layer>`). Mover
  una figura es una operación CRDT sobre atributos, no un reemplazo de texto.
- **Unidad: el milímetro** (`width="160mm" viewBox="0 0 160 120"`), para que lo
  que mide el panel sea lo que mide en el papel. Lo importado se normaliza.
- **Un fragmento sin integrar no se puede leer**: `svgToFragment()` devuelve uno
  así, hay que pasarlo por `DrawStore.put()`.
- **Un tipo Yjs integrado no se reinserta** (lo mismo que con `Y.Text` al
  renombrar en ColabTeX): orden Z, agrupar y renombrar clonan y borran; cada
  elemento lleva un `id` estable para rehacer la selección.
- **Durante un arrastre no se escribe en la nube**, solo en el DOM espejo; al
  soltar se escribe una vez. Un `mousemove` dispara 60 veces por segundo y cada
  escritura sería un envío a Realtime Database.
- **Capas** (`draw/layers.js`): el panel las lista de arriba abajo tal y como
  se ven. Lo que se dibuja va siempre a la capa activa. El ojo la oculta con el
  atributo `display`, así que también sale oculta en el SVG exportado (como en
  Inkscape), y el candado impide seleccionar sus figuras. Reordenar capas o
  mover figuras entre ellas clona y borra, porque un tipo de Yjs ya integrado
  no se puede reinsertar; al cambiar de capa se recompone el transform para que
  la figura no se mueva de sitio.
- **Exportar** (`draw/export.js`) genera SVG y PNG y los guarda como recursos
  normales del proyecto (`assetsIndex`), que es el gancho para vincularlos luego
  desde un proyecto de ColabTeX.

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
                                 (el Y.Doc guarda tres mapas: "files" ruta→texto,
                                  "folders" ruta→true para carpetas vacías, y
                                  "comments" id→hilo de comentario; las rutas
                                  pueden llevar subcarpetas: cap1/intro.tex)
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
- **Renombrar y mover** (`src/file-move.js`): el botón ✎ de cada fila del
  árbol renombra (admite escribir una ruta, que además lo mueve), y las filas
  se pueden arrastrar: sobre una carpeta entra dentro, sobre un archivo entra
  en la carpeta de ese archivo, y sobre el hueco del árbol sale a la raíz. La
  ruta ES la identidad del archivo, así que las dos cosas son la misma
  operación. Después se reescriben las referencias exactas de los .tex
  (`\includegraphics`, `\input`, `\include`, `\bibliography`…, con extensión o
  sin ella). En la nube hay que rehacer el Y.Text (un tipo de Yjs no se puede
  reinsertar bajo otra clave), y por eso los comentarios se vuelven a anclar
  por posición; las imágenes de Storage se copian y se borra la vieja, porque
  Storage no sabe renombrar. En local se copia y se borra: el disco tampoco.
- **Formato del texto** (`src/format.js`): se selecciona y se pulsa **B / I /
  U** o el botón de color en la barra del editor (o Ctrl+B / Ctrl+I / Ctrl+U).
  Escribe `\textbf`, `\textit`, `\underline` y `\textcolor` en el propio .tex —
  no hay estado oculto—, y los botones ALTERNAN: sobre un fragmento que ya
  tiene el comando, se lo quitan. La primera vez que se usa un color se añade
  `\usepackage{xcolor}` al preámbulo del archivo principal (y si estaba el
  viejo `color`, se sustituye: son incompatibles).
- **Comentarios** (`src/comments.js`): se selecciona texto y se le adjunta
  un hilo que ven todos. Cada hilo es un `Y.Map` dentro del mapa `comments`
  del Y.Doc: `{file, anchor, head, quote, author, createdAt, resolved,
  resolvedBy, messages: Y.Array}`. `anchor`/`head` son posiciones RELATIVAS
  de Yjs (`Y.relativePositionToJSON`), así el resalte sigue al texto aunque
  otros editen encima. Solo funciona en la nube (los invitados de solo
  lectura los ven pero no pueden escribir: lo impiden el proveedor y las
  reglas de Firebase). En modo local (carpeta de disco) no hay comentarios.
