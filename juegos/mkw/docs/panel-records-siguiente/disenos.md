# Panel de récords de Mario Kart Wii en «Clasificaciones» de Juegos — 3 propuestas

## Lo que hay (hechos)
- Datos: Firebase RTDB `mkw/records/<pista hex 3>-<cat>/<uid>` = { uid, nombre (≤20), ms, pista, cat, personaje, kart, version, at }.
  Lectura pública (`.read: true`), cada uno escribe solo su fila y solo si mejora. Una fila por persona y tabla (su mejor tiempo).
- `cat` = modo + cc: `tt150`, `tt200` (Contrarreloj) y `vs150`, `vs200`, `vs100`, `vs500`, `vsespejo` (Carrera/GP: el tiempo de la carrera entera).
- Pistas: 316 (79 copas × 4) de Retro Rewind, id = 0x100 + 4·copa + fila. Los NOMBRES y las miniaturas son privados
  (vienen del Worker de amigos con el token, `paquetes/indice.json` → `nombres[copa][fila]`, `copas.pak` íconos 64 px,
  `fotos-N.pak`). Sin el Worker: «Copa 12 · pista 3».
- Fantasma: el .rkg del récord de cada uno en Storage `mkw/fantasmas/<tabla>/<uid>.rkg` (solo tt150/tt200). El juego ya
  corre solo contra el del primero (§92). Bajarlo = un archivo de ~1–3 KB.
- Hoy la pestaña «Mario Kart Wii» de Clasificaciones muestra la tabla de la SALA (victorias, 3/1/0) con el podio grande.
- Estilo del panel: `ranks.js` — barra de juegos, filas de botones segmentados `.jg-rk-seg`, podio con corona, tarjeta
  «tu posición», `.jg-tabla`. Tema oscuro con `html[data-tema=oscuro]`. Mando del sitio (`mando.js`) = cursor sobre
  botones/enlaces. Celular: Chrome Android.
- Escala real esperada: un grupo de amigos (≤ 30 personas), pocas pistas con récord (decenas), no 316 llenas.

## Diseño A — «Explorador por pista» (lista de copas + detalle)
- Arriba: buscador («pista o piloto…»), un interruptor Contrarreloj | Carrera, y la cilindrada (150 | 200; en Carrera
  también 100/500/espejo si hay datos).
- Cuerpo: las 79 copas como acordeón (cerradas), cada pista una fila: miniatura, nombre, récord (tiempo + quién) y tu
  tiempo. Clic en una pista → se abre debajo el top 10 («ver más» → todos), tu puesto y «⬇ fantasma del 1.º».
- Pro: está todo, ordenado como el juego. Contra: 316 filas, la mayoría vacías; mucho scroll en el celular.

## Diseño B — «Resumen primero» (solo lo que tiene récord)
- Arriba: «Tu resumen» (cuántas pistas tienes, cuántos récords tienes, tu mejor puesto) y el buscador.
- Fichas: Contrarreloj 150 / Contrarreloj 200 / Carreras (las cc de carrera en un desplegable o segunda fila chica).
- Lista: SOLO las pistas con al menos un tiempo, ordenadas por «recién batido» (o por copa con un selector «Orden:
  recientes | copa | A–Z»). Cada fila: miniatura, nombre, 🥇 tiempo y piloto, tu tiempo y la diferencia (+0.412).
  Primeras 10 pistas + «ver más». Tocar una fila la despliega con el top 10 de esa pista y «⬇ fantasma».
- Arriba de la lista, una línea «Récords recientes» (los 3 últimos batidos) — opcional.
- Pro: corto, sin pistas vacías, va directo a «¿quién tiene qué?». Contra: no se ve qué pistas faltan.

## Diseño C — «Pistas | Pilotos» (dos vistas)
- Un interruptor arriba: «Por pista» (como B) y «Por piloto»: una tabla de pilotos ordenada por récords (1.º lugares)
  en la categoría elegida, con 🥇/🥈/🥉 y cuántas pistas corrió; tocar un piloto muestra sus tiempos pista por pista.
- El podio grande de ranks.js arriba en «Por piloto» (quién tiene más récords).
- Pro: da ganas de competir (el podio), y responde «¿quién es el más rápido?». Contra: dos vistas = más que aprender.

## Común a las tres
- Vive dentro de la pestaña «Mario Kart Wii» de Clasificaciones: un interruptor «Récords (Contrarreloj) | Sala» (por
  omisión Récords), así la tabla de victorias de la sala no se pierde.
- El buscador acepta tildes/errores (`buscador.js` `normaliza`/`parecido`): «coconut», «moo moo», «Ana».
- Datos de prueba de mentira. Nada del juego en el sitio salvo lo que ya baja del Worker.

## Veredicto del crítico (2026-11-09)
B + el podio de C. Récords|Sala; Tabla: CR 150 · CR 200 · Carrera ▾ (2.ª fila con solo las cc con datos); podio por 1.º lugares
+ «tu posición» en lenguaje de récords; buscador ancho «Buscar pista o piloto…»; solo pistas con tiempo, por récord más reciente,
10 + «Ver más (N)» de a 10; fila = un botón: miniatura 40 px, pista + copa chica, 🥇 tiempo y piloto, tu tiempo y diferencia.
Tocar = acordeón (una abierta): top 10 .jg-tabla (#, piloto, tiempo, pj+kart jg-opc), tu fila aunque estés más abajo, «⬇ Fantasma del 1.º»
solo CR; scrollIntoView nearest. Vacía: podio libre + frase. Sin Worker: «Copa 12 · Pista 3», ícono neutro, línea gris.
Sacar: acordeón de copas, selector de orden, tira recientes, resumen aparte, vista por piloto, pj/kart en la fila cerrada, cc vacías.
Celular: 2 líneas en 360 px, 44 px. Mando: fila = 1 botón; enterkeyhint=search, Enter/Esc sueltan foco; «Ver más» deja el foco en la 11.
Repintar por firma. Buscador: todas las palabras en pista/copa/piloto del top; si una palabra es un piloto, la fila muestra su tiempo;
120 ms; con texto sin tope; «Sin récord todavía» (≤5) al final; contador «N pistas» y ✕; se mantiene al cambiar de tabla.

## Pedido del dueño (2026-11-09 ~20:50): «agrega filtros en el buscador»
Botón «Filtros (n)» al lado del buscador → panel con «Tú» (Todas · 🥇 Mis récords · Corridas · Me faltan) y «Consola»
(SNES…SW2, solo las presentes, con su cuenta bajo el filtro «Tú»; sin nombres no aparece) + «Quitar los filtros».
Cerrado: pastillas «Corridas ✕» «SNES ✕» junto a «3 de 25 pistas». «Sin récord todavía» solo con «Todas» (y de esa consola).
Se recuerdan en sessionStorage `jg.mkwFiltro`. Pasarle al crítico en la revisión con fotos.
