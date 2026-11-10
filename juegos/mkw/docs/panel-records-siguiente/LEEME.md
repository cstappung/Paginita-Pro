# Panel de récords de MKW en Clasificaciones — borrador para la siguiente actualización

Pausado el 2026-11-09 («todo lo demás a una futura update») y **terminado el 2026-11-10** («Sí, termínalo»): bitácora §267, rama `mkw-records` del sitio. Lo de abajo queda como historia del borrador.

## Qué hay aquí
- `mkw-records.js` — el borrador del módulo `colabtex/src/juegos/mkw-records.js` (puro + `crearListaMkw`).
- `disenos.md` — las 3 propuestas, el veredicto del crítico y el pedido de filtros.
- `armar-vista.cjs` + `vista-previa.html` — la vista previa (abre con doble clic; datos y nombres de pista
  inventados, sin íconos). `node docs/panel-records-siguiente/armar-vista.cjs` la rehace.
- Fotos (con los nombres reales, por eso fuera de git): `build/vistas/panel-records-*.png`.

## Lo que eligió el crítico
Diseño B + el podio de C: interruptor Récords | Sala; Tabla CR 150 · CR 200 · Carrera ▾ (cc con datos);
podio por 1.º lugares; buscador «Buscar pista o piloto…»; solo pistas con tiempo, por récord reciente,
10 + «Ver más»; la fila es un botón (ícono, pista + copa, 🥇 tiempo y piloto, tu tiempo y diferencia);
acordeón con top 10, tu fila y «⬇ Fantasma del 1.º» (solo CR).

## Filtros (pedido del dueño)
«Filtros (n)» junto al buscador: «Tú» (Todas · 🥇 Mis récords · Corridas · Me faltan) y «Consola»
(solo las presentes, con su cuenta) + «Quitar los filtros»; cerrado, pastillas con ✕. sessionStorage
`jg.mkwBusca` / `jg.mkwFiltro`.

## Lo que falta
1. Pasarlo al sitio: `mkw-records.js`; en `ranks.js` el interruptor Récords|Sala y la fila Tabla para «mkw»,
   el podio con `podioMkw` por `pintaEscena`; `fb-juegos.js` `watchMkwRecords` (onValue `mkw/records`,
   sin vetados); `mkw.js` un cargador `pistasMkw()` (token + `indice.json` + `copas.pak`) y `fantasmaBajar`;
   el ctx en `juegos-main.js`; rearmar `juegos-app.js` con esbuild (nunca `npm run build`).
2. Pruebas: `colabtex/tests/mkw-records.test.cjs` nueva + `mkw.test.cjs`; con los emuladores.
3. Segunda revisión del crítico con fotos (escritorio y celular), filtros incluidos.
4. Bitácora (§ nuevo + glosario), PLAN.md, CLAUDE.md, commit local; PR solo con el sí del dueño.
Las reglas de Firebase no cambian.
