# Banner y miniaturas de MKW en el sitio: para la siguiente actualización

El dueño lo pasó a la siguiente update el 2026-11-09 («algo cortito, mejor dejalo para la siguiente update»).
No se tocó ningún archivo del sitio (`terceros/Paginita-Pro`).

## Lo que hay hoy (leído en el código)

- **Novedades (el banner):** MKW **no tiene diapositiva**. `NOVEDADES` de `colabtex/src/juegos-main.js` no trae
  `id: "mkw"`, aunque `filtraNovedades` ya la esconde a quien no es amigo (`bt3Visible()`). Tampoco hay escena en
  `colabtex/src/juegos/novedades-arte.js` (`ESCENAS`). Rehacerlo = agregar la novedad y una escena SVG 1200×420
  (el motivo entre x 600 y 1180, clases `ep-*` animadas desde `juegos.html`, solo en `.jg-ban-c.on` y nunca con
  «menos movimiento»).
- **Las miniaturas (4:3 del salón y ficha 16:7):** las dos salen de `arteJuego("mkw")` (`juegos-main.js` ~4342):
  `.jg-art-mkw` = una bandera a cuadros en CSS (`juegos.html` ~1890) con el texto «Retro Rewind / Mario Kart Wii».
  La práctica `bots-mkw` (`salon-datos.js`) usa el mismo arte (`arte()` de `salon.js` → `ctx.arteMulti(e.juego)`);
  `portadas-solo.js` no tiene nada de MKW.
- **El nombre:** hoy el sitio dice «Mario Kart Wii» (`motor.js` `nombre`, `salon-datos.js` «Mario Kart Wii · un
  jugador», el arte). «JloKart Wii» solo aparece como el menú de inicio del juego. Si el arte nuevo debe decir
  «JloKart Wii», preguntar al dueño si también cambian los nombres de las tarjetas.
- **Fotos:** sin Playwright no hay fotos de MKW en el salón, porque solo lo ven los amigos. Las de hoy
  (`build/vistas/salon-mkw-antes-*-banner.png`: escritorio y celular, claro y oscuro) muestran el banner sin MKW.
  Las de las tarjetas no salieron (la herramienta no encontró `.jg-mn[data-id="mkw"]`: faltaba averiguar por qué;
  ver abajo).

## La herramienta empezada

`herramientas/vistas-salon-mkw.mjs` (sin commit) arma un `juegos-app.js` de vista previa con esbuild, donde
`bt3-amigos.js` dice que sí a todos. Sirve el sitio en 127.0.0.1 con la red cortada (salvo las fuentes de Google) y
saca fotos con Chrome sin ventana (`channel: 'chrome'`). Falta ver por qué no salen las tarjetas de MKW: puede que
el salón invitado no las pinte o que haga falta esperar a que carguen los datos.

## Ideas para retomarlo

1. Escena del banner: una pista vista desde un costado de noche, con karts de siluetas propias (sin personajes),
   estelas de turbo, una bandera a cuadros y un semáforo de largada que se prende.
2. Miniatura: un kart propio de frente con la bandera detrás y «JloKart Wii» en una tipografía del sitio (Lilita
   One), nunca las letras del juego.
3. Seguir el método del encargo: un crítico de diseño elige entre 2 o 3 direcciones y revisa con fotos en escritorio
   y celular, en claro y oscuro. Antes de rearmar `juegos-app.js`, mirar `git status` del sitio (hoy hay cambios a
   medias de otras sesiones en `mkw.js` y `motor.js`).
4. Número de bitácora: §264 y §265 ya están tomados. Mirar las notas compartidas antes de elegir uno.
