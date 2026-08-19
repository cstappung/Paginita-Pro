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
colabdraw-math.js   Motor de fórmulas LaTeX (MathJax → SVG). Bundle APARTE:
                    solo se descarga la primera vez que se escribe una
                    fórmula, y lo pide draw/latex.js con el ?v= de la página
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
- **Árbol de objetos** (`draw/layers.js`): es el panel «Objetos» de Inkscape, no
  una lista de capas. Enseña el árbol entero, porque un archivo importado no
  trae capas y con una lista de capas aparecía como una sola fila. Se pintan
  solo las ramas desplegadas: esos archivos traen miles de nodos. Cada nivel se
  lista de arriba abajo tal y como se ve. La selección va en los dos sentidos, y
  lo que se elige en el lienzo abre la rama donde está. El ojo (`display`) y el
  candado (`data-locked`) valen para cualquier nodo, y el candado se hereda: al
  bloquear un grupo se bloquea lo que lleva dentro. El nombre sale de
  `data-label` (el `inkscape:label` que se conserva al importar), `data-layer` o
  el `id`. Lo que se dibuja va siempre a la capa activa. Reordenar capas o mover
  figuras entre ellas clona y borra, porque un tipo de Yjs ya integrado no se
  puede reinsertar; al cambiar de capa se recompone el transform para que la
  figura no se mueva de sitio.
- **Lo generado vive con los dibujos** (`draw/preview.js`): un PNG exportado es
  un archivo del proyecto igual que el `.svg` del que salió, así que va en la
  misma lista y se abre en el sitio del lienzo, con un botón para descargarlo.
  Antes se bajaba de golpe al pulsarlo, sin poder mirarlo. El PDF se enseña en
  un `<iframe>` con el visor del navegador: traer pdf.js sumaría más de un mega
  para una figura de una página.
- **Vincular con ColabTeX** (`draw-link.js`): desde un proyecto de LaTeX se
  vincula uno de dibujo y sus figuras exportadas aparecen en el árbol de
  archivos, bajo `figuras/<nombre>/`, como recursos normales. El vínculo vive
  en el **documento Yjs** (`Y.Map "links"`), así que se sincroniza con todo el
  equipo y no hace falta publicar reglas nuevas a mano. Guarda el token de
  invitación del proyecto de dibujo: cada colaborador del artículo se apunta
  solo la primera vez que lo abre, por el mismo camino que un enlace para
  compartir. No se copian los bytes — la figura del PDF es siempre la última
  que se exportó — y `fb.watchAssets` mantiene la lista al día sin recargar.
- **Color y degradados** (`draw/paint.js` + `draw/color-popover.js`): cada
  canal (relleno y trazo) es UNA muestra que se pulsa y abre el cuadro, en vez
  de las dos parrillas de quince colores siempre desplegadas. Dentro está la
  paleta, el mapa de colores del sistema, el hexadecimal y el editor de
  degradados: lineal con ocho direcciones y ángulo escrito, o radial con el
  centro en cualquiera de nueve sitios, y tantas paradas de color como se
  quieran. El degradado se guarda en el `<defs>` del dibujo en unidades de la
  caja de la figura, así que la sigue al moverla, escalarla o girarla; las
  definiciones que dejan de usarse se recogen solas, y viajan con la figura al
  copiar y pegar.
- **Polígonos y estrellas** (`draw/geom.js` + `draw/tools.js`): la herramienta △
  del rail (G) dibuja un polígono de los lados que se pidan en la barra de
  arriba, y con la casilla «Estrella» intercala un vértice más cerca del
  centro. Se inscribe en la caja que se arrastra, como la elipse, así que un
  triángulo puede salir alto y estrecho sin escalarlo después.
- **Flechas** (`draw/paint.js`): la línea admite punta al principio, al final o
  en los dos, elegida en la barra de la herramienta antes de dibujar o en la
  sección TRAZO del panel para una que ya esté puesta. Es un `<marker>` único
  por dibujo: crece con el grosor del trazo y se pinta de su color, así que no
  hace falta uno por flecha. Solo se les pone a las figuras abiertas (línea,
  polilínea, trazado): en un rectángulo no pintaría nada y en un polígono
  saldría una flecha suelta en un vértice.
- **Zoom con Ctrl+rueda**: de cinco en cinco puntos de porcentaje, una muesca
  un paso, y redondeando al múltiplo de 5. Antes era multiplicativo y el mismo
  gesto daba un salto distinto según el ratón y el navegador.
- **Sombra** (`draw/paint.js`): un `<filter>` con un `feDropShadow` en el
  `<defs>`. Se enciende con una casilla en el panel y se ajusta el
  desplazamiento, el difuminado, el color y la opacidad; se vuelve a leer del
  propio filtro, así que se puede corregir cuantas veces haga falta. Un filtro
  que venga de un archivo importado NO se enseña como sombra: el panel avisa
  de que hay uno propio antes de sustituirlo.
- **Esquinas del rectángulo**: el radio se elegía antes de dibujar y ya no se
  podía tocar. Ahora la sección RECTÁNGULO del panel lo enseña y lo cambia
  mientras todo lo elegido sean rectángulos.
- **Varias líneas en una fórmula**: se separan con `\\` (botón «↵ salto» del
  cuadro). El entorno lo pone el editor —`aligned` si hay `&`, `gathered` si
  no—, porque un `\\` suelto en modo matemático es un error de LaTeX; en
  `data-latex` se guarda lo que se escribió, no la envoltura.
- **Encuadre y zoom** (`draw/canvas.js` + `draw/scrollbars.js`): el encuadre
  está en el `transform` de la escena, no en el scroll de una caja, así que las
  barras de desplazamiento se pintan a mano. Su recorrido es la página **más
  todo lo dibujado** (una figura importada puede caer fuera del papel) con un
  margen de un cuarto de su tamaño, y desaparecen cuando ya cabe todo. El zoom
  se **escribe** en la barra de abajo («250», «250%» o «2,5x»), además de los
  botones −/+/1:1, la rueda con Ctrl y el ⤢ de ajustar.
- **Copiar y pegar** (`draw/tools.js`): va por los eventos `copy`/`cut`/`paste`
  del documento, no por Ctrl+C en el teclado, para tener el portapapeles de
  verdad sin pedir permisos. Se guarda TEXTO SVG, no nodos: un clon de Yjs sin
  integrar no se puede leer y solo valdría para pegar una vez. Sin nada elegido
  se copia la capa activa entera.
- **Arrastrar en el árbol de objetos**: tres zonas por fila; los bordes colocan
  al lado y el centro mete dentro del grupo. Al cambiar de padre se recompone
  el transform. Una capa solo cuelga del `<svg>`; una figura, solo de una capa
  o un grupo.
- **Importar respeta las capas del archivo** (`draw/svgio.js`). Inkscape no
  tiene un tipo «capa»: es un `<g inkscape:groupmode="layer">` con el nombre en
  `inkscape:label`, oculto con `style="display:none"` y bloqueado con
  `sodipodi:insensitive`. Se traduce todo eso a lo nuestro y la conversión a
  milímetros se antepone al transform de cada capa, en vez de envolver el
  dibujo en un `<g>` de más. Lo que hace falta se lee del DOM de origen de una
  vez, porque un elemento Yjs recién convertido aún no está integrado y no
  devuelve nada al leerlo (por eso también los `<defs>` se copian hijo a hijo).
- **Selección al estilo de Inkscape** (`draw/tools.js`): clic normal → el grupo
  entero; **Ctrl+clic** → la figura concreta bajo el puntero, esté donde esté
  anidada; **Alt+clic** → igual, y repetido va bajando por las figuras
  superpuestas; **doble clic** → entra en el grupo (o abre el texto).
- **Corregir una fórmula**: doble clic o Intro sobre ella, y también el botón
  **Editar fórmula** de la sección FÓRMULA del panel derecho, que aparece con
  una fórmula elegida y enseña su LaTeX. Los dos primeros no se ven por ningún
  sitio: sin el botón, una fórmula puesta hace días parecía intocable.
- **Texto** (`draw/text.js`): un `<text>` con un `<tspan>` por línea; el salto
  va en `em` para que cambiar el cuerpo no descoloque el interlineado. Se
  escribe en un `<textarea>` encima del lienzo y se guarda al cerrar, no a cada
  tecla. Un texto que se deja vacío se borra. La lista de fuentes son solo las
  tres genéricas: al exportar a PDF sin incrustar tipografías únicamente
  existen las catorce estándar.
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
