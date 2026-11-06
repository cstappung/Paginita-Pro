# Antitrampas de Type Race

Una tabla por largo, solo para las **palabras al azar en inglés**:
`club-typerace-en-10`, `-25`, `-50` (la estándar), `-100` y `-200`.
`puntos` son las **ppm** de la carrera (enteras: cinco caracteres por palabra,
solo palabras bien escritas) y `tiempo` los ms entre la primera letra y la
meta, que desempata. Tope de `puntos`: 330. El español, las frases, los
cuentos y el modo libre se practican, pero no clasifican.

## La prueba

`{v: 1, u, s, e, a, w}`:

- `u`: la cuenta. `s`: la semilla (32 bits). El texto de la carrera sale de
  las dos juntas (`semillaDe`, FNV-1a), así que una prueba copiada de otra
  persona reparte otras palabras y no se puede rehacer.
- `e`: las entradas, cada una `[0, lo que decía el campo, Δms]` (un evento
  `input`, que puede traer una letra o varias, y un espacio en el medio
  cierra la palabra) o `[1, "", Δms]` (borrar con el campo vacío para volver
  a una palabra mal escrita). Si el evento no era de una mano
  (`isTrusted` falso) lleva un cuarto elemento `"x"`. La primera entrada va
  con Δms 0.
- `a` / `w`: lo corrido según `performance.now` y según `Date.now`. El juego
  usa ms **enteros** para que el verificador rehaga exactamente lo mismo.

## Qué comprueba `solo/verifica/typerace.js`

- La tabla existe, la prueba tiene la forma y la versión esperadas y es de
  la cuenta que la sube (`u`).
- Rehace la carrera con el mismo `motor.js` (`rehace`): tiene que llegar a la
  meta, sin pulsaciones de sobra, y las **ppm y el tiempo** declarados tienen
  que salir iguales.
- Ninguna entrada sintética (`x`).
- Los dos relojes tienen que coincidir (`dosRelojes`) y la carrera no puede
  durar más que el reloj del juego.
- Precisión de al menos 75 % (pulsaciones buenas sobre las totales).
- La mano: nada por encima de 330 ppm, y no hay 20 entradas seguidas a menos
  de 20 ms.

`sospecha(categoria, fila)` solo puede mirar el tope (330 ppm) en una fila
guardada sin su prueba.

## El límite honesto

Un programa que teclee a ritmo de persona, con eventos de verdad (un
automatizador del sistema operativo), saca una prueba válida; nada de lo que
pasa en el navegador lo distingue. Lo que sí queda atrás: números inventados,
pruebas copiadas, el reloj acelerado o frenado, `Club.result` desde la consola
y los bots que inyectan eventos sintéticos o pegan texto. Las ppm de un humano
muy bueno (200 a 250) son creíbles; por encima de 330 no se acepta nada.
