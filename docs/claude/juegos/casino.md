# Casino (pestaña «Casino» de Juegos)

Apostar las monedas: **El Avión** (crash) y **Pingüinito** (saltar
témpanos). Ruta `#casino`, `#casino/avion`, `#casino/pinguino`.

Archivos:

- `colabtex/src/juegos/casino-motor.js` — puro (sin DOM), lo usan la
  economía y `tests/casino.test.cjs`. Límites, multiplicadores, `azar`,
  `resuelveAvion`, `resuelvePinguino`, `resuelve`.
- `casino.js` — la pestaña: cabecera (saldo, 🔊 y volumen de efectos),
  menú con fichas animadas, «Tus números», «Grandes premios». Pasa un
  `api` a cada juego.
- `casino-avion.js`, `casino-pinguino.js` — un canvas cada uno, con
  `montarX(h, api)` → `{datos, destruir}`.
- Estilos: bloque `.jg-cs-*` al final de `juegos.html`. El casino es
  siempre oscuro, así que no tiene gemelos en el bloque `data-tema=oscuro`.
- Sonidos en `sonido.js` (`despega`, `hito`, `cobra`, `explota`, `salta`,
  `aterriza`, `cruje`, `chapuzon`), siempre por `busFx`.

## El azar decide el pasado (la regla que no hay que romper)

Una ronda es `casino/<uid>/<clave>` = `{j, p, d?, at}` y cada decisión es una
escritura de una vez con la hora del servidor (`=== now` en las reglas):
avisos del avión `t/<i>` (cada `AVISO` = 350 ms mientras vuela), saltos del
pingüino `s/<i>`, y retiro `c`. Lo que pasó en el tramo que termina en esa
hora sale de `sha256("casino:"+uid+":"+clave+":"+etiqueta+":"+ms)`. Nada está
guardado de antemano, y nadie elige el milisegundo en que llega su escritura.
**Nunca** guardar un punto de choque ni una semilla que el cliente pueda leer
antes de decidir.

- Avión: con probabilidad 3 % choca en ×1 al despegar. Después, el tramo
  [a, b] se sobrevive con probabilidad M(a)/M(b), con M = exp(0,11·t). A
  ×100 (unos 42 s) se va del cielo.
- Pingüino: cada salto cae con `cae`. El multiplicador es
  `floor2(0,97 / (1−cae)^n)` y llegar al último témpano cobra solo.
- Las dos son martingalas: **cualquier** estrategia (a mano, con un
  programa, retirarse antes o tarde) espera 0,97. Por eso no hay antitrampas
  de automatización: no hay nada que ganarle. `tests/casino.test.cjs` lo
  comprueba por simulación. Si se toca una fórmula, la prueba tiene que
  seguir dando 0,97.
- El pago va en **centésimas** (`pagoDe`). Redondearlo a monedas enteras le
  quitaba hasta un 10 % a la apuesta mínima. `economia()` suma los premios
  así y los redondea hacia abajo una sola vez (`x.premios`).

## Límites

Apuesta mínima: 10 para todo. Las máximas: Avión 500. Pingüino según
dificultad: Fácil 1000 (cae 1/10, 20 témpanos), Medio 500 (1/5, 15),
Difícil 200 (1/3, 12) y Extremo 50 (1/2, 10). La regla `casino` de
`database.rules.json` repite estos números: si cambian en el motor, cambian
también allí y en `test-rules.mjs`.

## Economía (`monedas.js`)

Hay dos eventos. `ca` es la apuesta: se cobra a la hora `at` por `paga`.
`cp` es el premio: se suma a la hora `fin`, y solo si la apuesta valió.
Una apuesta sin fondos no juega ni paga, y la cuenta queda **parada**,
como cualquier gasto sin fondos. `monedasDe` devuelve `premios` y
`casino: {apostado, pagado, rondas}`. `economia(d).rondas["uid~clave"]`
trae cada ronda resuelta, que es lo que lee el feed.

`watchLogros` lee `casino` entero con 1 s de pausa. El nodo es pequeño:
una ronda pesa unos pocos cientos de bytes.

Las reglas de `casino` hay que **publicarlas a mano**: ver
`firebase/CONFIGURAR-FIREBASE.md`.
