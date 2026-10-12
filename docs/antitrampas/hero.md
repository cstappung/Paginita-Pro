# Antitrampas de PRO HERO

Dos niveles, porque lo que se guarda son dos cosas distintas:

1. **Cada canción terminada** (`heroMias`, `heroCanciones`). La verifica
   `verificaHero` (`colabtex/src/juegos/hero-datos.js`) en el navegador de
   quien toca, **antes** de escribir nada: el juego manda la prueba de la
   partida y los bytes del chart, y la página vuelve a tocarla con el mismo
   motor (`juegos/hero/js/game/prueba.js`: `rehace`).
2. **La fila de la clasificación** (`soloRanks/club-hero-estrellas`). Es un
   resumen de todas tus canciones; su prueba en `soloPruebas` es el mapa de
   estrellas por canción (`{v: 1, c: {clave: [doradas, azules]}}`), y
   `solo/verifica/hero.js` comprueba que la fila diga exactamente lo que suma
   ese mapa. Así un récord de la tabla se audita canción por canción.

## La prueba de una canción

El motor ya no avanza al ritmo de los cuadros de la pantalla, que cambia de
un computador a otro: avanza en una **rejilla fija** de 5 ms de canción
(`Grabadora.hasta`), y cada acción (trastes, rasgueo, Star Power, whammy,
golpes de batería, y el «soltar los trastes» al volver de la pausa) se
redondea a 0,1 ms y se anota con el punto de la rejilla al que había llegado
el motor. Repetirla da las mismas llamadas, en el mismo orden y con los
mismos números, así que el puntaje y las estrellas tienen que ser
**idénticos**, no parecidos.

`{v: 1, id, p, d, m, xp, pc, w, k, e}`: la canción (`id` de library.json),
la parte, la dificultad, el modo de notas, Expert+ y platillos pro (que
cambian el chart), la ventana de acierto (fija en 70 ms), el último punto de
la rejilla y los sucesos, `Δk,Δt,código` en base 36.

Se rechaza si:

- la clave de la canción no es la de su `id`, o la prueba es de otra parte o
  dificultad que la que dice el resultado;
- la canción no se tocó entera (el último punto de la rejilla no llega a la
  última nota);
- el puntaje o las estrellas no salen iguales al repetirla (un puntaje
  editado en la consola);
- **parece un bot** (`pareceBot`): con 60 aciertos o más, el 90 % cae a
  menos de 2 ms de su nota. El bot del juego (y un script que manda teclas a
  la hora exacta) acierta así; una persona reparte decenas de ms. Las notas
  abiertas de «Todo taps» no cuentan: esas entran solas en la rejilla.

Las partidas con bot no llegan a mandarse: el jugador que es bot no tiene
grabadora. Un rechazo deja un aviso en `sospechas/<uid>` pero **no castiga**
(`vivo: false`): un juego y una página de versiones distintas en la caché
también darían «no cuadra».

## Límite honesto

La prueba de cada canción no se guarda (pesaría decenas de kB por canción):
se verifica una vez, en vivo. Y el chart lo manda el juego, así que un
cliente reescrito puede mandar un chart más fácil, o fabricar una prueba
válida tocando con un programa que imite a una persona. Lo que sí queda
fuera es lo fácil: editar el puntaje en la consola, el bot del juego, un
script que pulse a la hora exacta. Como en todo el sitio, solo un servidor
cerraría el resto.
