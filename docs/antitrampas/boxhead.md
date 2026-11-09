# Antitrampas de Pro BoxHead (Solo Club)

Cinco tablas, una por mapa: `club-boxhead-(patio|sotano|cruce|fortaleza|laberinto)`.
`puntos` = el nivel al que llegaste en una práctica (en el que caíste); `tiempo` =
los ms de juego que tardaste en llegar a ese nivel (`(paso + 1) × 1000 / 60`, el paso
en que empezó). Con el mismo nivel manda el menor tiempo. Las monedas salen de la fila (`monedas.js`: 2 por nivel en
cada mapa, hasta el 150), así que la fila es lo que hay que proteger.

## La prueba

El Club abre el mismo marco de la sala, `juegos/boxhead/index.html?club=1`, que
carga `conexion.js` y pone la tabla en su menú. En la práctica el juego es
determinista (`juegos/boxhead/CLAUDE.md`, «Phase 2.1»): el azar sale de una
semilla mezclada con la cuenta (mulberry32 de `s ^ FNV(u)`), avanza en pasos
fijos de 1/60 s y la grabadora anota lo que hace el jugador con el paso en que
ocurrió:

`{v: 1, ve, u, m, s, j, k}`: versión de la prueba, versión del motor, la cuenta,
el mapa (índice de `ORDEN_MAPAS`), la semilla, las jugadas y el paso final. Cada
jugada es `[paso, 0, mov, vel·20, mira+1, fija|disp<<1]` (lo que piden el teclado
o el stick, solo cuando cambia) o `[paso, código, arg]` (1 cambiar de arma ±1,
2 elegir arma, 3 detonar, 4 muro reforzado, 5 subir el nivel de un arma,
6 comprar el ítem i de `D.TIENDA`, 7 elegir la ventaja i de las tres que salieron; si no se elige, el juego toma la primera solo y eso no se graba).

`solo/verifica/boxhead.js` la rehace con el juego mismo, sin pantalla
(`js/sin-pantalla.js` vuelve inertes el DOM, el canvas y el audio): en el
navegador en un Web Worker (`js/verificador.js`), en Node con
`js/rehace-node.cjs` (tests y `scripts/auditar-club.cjs`). Se rechaza si:

- la tabla no es de Pro BoxHead, el nivel no es un entero de 1 a 999, o la prueba
  no tiene la forma;
- la prueba es de otra cuenta o de otro mapa;
- la partida rehecha no termina (no muere), termina en otro paso, llega a otro
  nivel o el tiempo no cuadra.

Copiar la prueba de otra cuenta no sirve: la cuenta está en la semilla, así que
con otra `u` la partida es otra. `sospecha` marca filas con niveles de menos de
4 s de juego cada uno.

## Lo que no se puede probar

Un programa que juegue de verdad (un bot que lea la pantalla y apriete teclas)
saca una prueba válida; todavía no hay un detector de patrones de bot como el de
PRO PACMAN. Y el motor usa trigonometría, que en el último bit puede diferir
entre motores de JavaScript: una partida jugada en Firefox se verifica en Firefox
(pasa), pero la auditoría en Node podría no rehacerla igual. Mismo riesgo que PRO
DEFENDER.

**Cambiar la simulación obliga a subir `VE`** en `juego.js`: una prueba vieja
rehecha con el motor nuevo llegaría a otro final.
