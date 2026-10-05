# Antitrampas de Metro Rush

Metro Rush (`juegos/club/metrorush/`) es un runner 3D en tiempo real. Sus
dos tablas son `club-metrorush-carrera` (los puntos de una carrera) y
`club-metrorush-distancia` (los metros, solo cuando mejoran). Este archivo
dice por dónde se colaba una trampa, qué prueba manda ahora cada carrera y
qué no se puede probar.

## 1. Vías que había

| Vía | Cómo | Qué la para ahora |
|---|---|---|
| `Club.result` desde la consola | una línea | sin prueba se rechaza (`PRUEBA = 1`) |
| `__metrorush.puntos(n)` | fija los puntos | la carrera queda «de prueba» y no se manda; y si se mandara a mano, los puntos no son los que da la prueba |
| `__metrorush.avanza(seg)` | corre la carrera sin dibujar, en un instante | «de prueba»; y el reloj de juego le gana al real |
| `__metrorush.inmortal()`, `poder(k)`, `pulsa(a)`, `logica()` | sin choques, poderes a voluntad, un bot | «de prueba» (no se manda) |
| Editar `progreso.retos.nivel` (el multiplicador base) | localStorage o la consola, a mitad de carrera | a mitad de carrera, los puntos ya no cuadran con el base anotado al empezar; antes de empezar, ver el límite honesto |
| Acelerar el reloj (`requestAnimationFrame` trucado) | el juego corre en cámara rápida | el tiempo de juego no puede adelantarse al reloj real |
| Una prueba fabricada a mano | inventar estrellas, metros o tiempos | se rehace: la pista sale de la semilla, los metros de la velocidad, los puntos de los tramos |
| Teclas despachadas por un script | `dispatchEvent` de `KeyboardEvent` | se cuentan (`isTrusted` falso, salvo las del mando con un mando conectado) y la carrera no se manda |

## 2. Qué se eligió: rehacer el puntaje, no la física

La física del corredor (saltos, choques, techos) va con el dibujo y con el
tiempo de cada cuadro, que cambia de un aparato a otro: rehacerla exacta
obligaría a separar mil líneas de pantalla y a llevar el largo de cada
cuadro. Pero **los puntos no salen de la física**: salen de los metros y
del multiplicador.

- Los metros los da la velocidad, que solo depende del tiempo de juego:
  `34 − 19·e^(−t/130)` m/s (`M.velocidad`, con la curva en `M.VELOCIDAD`). Entre dos instantes se corre su
  integral (`metrosEntre`).
- El multiplicador solo cambia con las estrellas (+1 cada una, hasta +29),
  el 2× (× 2 lo que dura) y el Potenciador +5, sobre el base con que se
  empezó.
- Los puntos de un tramo son `10 × multiplicador × metros`.

Con eso se recalcula el puntaje **exacto**. Ejemplo: base ×3, 100 m sin
nada (3 000 puntos), una estrella (×4) y 50 m más (2 000): 5 000.

Para que una estrella o un 2× no se puedan inventar, **la pista tiene que
salir igual de la semilla**. No salía: el generador ponía los trenes que
vienen de frente con la velocidad del cuadro en que generaba el bloque, y
eso movía el tren, el carril que dejaba libre y todo lo que venía después.
Ahora esa velocidad sale de la distancia (`velocidadEn(d)`, redondeada a
medio m/s), así que la pista depende solo de la semilla y de los pedidos del
juego. Un tren se cruza ~2 m más allá de su fila si el corredor va 1 m/s
más rápido de lo calculado: no se nota.

### Formato (`prueba.js`, el mismo archivo para el juego y el verificador)

```js
{ v: 2, s: <semilla>, b: <base>, md: <nivel del 2×>, u: <cuenta>, sn: <entradas sintéticas>,
  i: [                                // los pedidos al generador, con su punto de la pista (dSig)
    ["B", dSig, n, desde],            //   un boleto dorado
    ["T", dSig, desde, estacion],     //   un túnel (cambio de estación)
    ["C", dSig, desde, hasta, carril] //   la cinta de monedas de la mochila cohete
  ],
  e: [                                // los eventos: [código, t (s de juego), D (m), r (ms reales), id?]
    ["w", 2.0167, 26.45, 14700],      //   una muestra cada 2 s
    ["e", 31.5, 421.7, 1288, 812],    //   una estrella (812 es su número en la pista)
    ["d", ...], ["x", ...], ["p", ...],  // 2× recogido, fin del 2×, +5
    ["m", ...], ["s", ...], ["f", ...]   // choque, seguir corriendo, fin
  ] }
```

Los números de los pedidos y de los bordes de los tramos van tal cual (sin
redondear): el generador tiene que repetir lo mismo objeto por objeto, y
los puntos se suman con esos metros. Una carrera de 10 minutos ocupa ~11 kB
(el tope de una prueba es 200 kB).

## 3. Qué verifica (`rehace` + `verifica/metrorush.js`)

1. **La forma**: versión, semilla, base 1–30, nivel del 2× 0–5, que termine
   en `f`, que no haya entradas sintéticas.
2. **La pista**: la regenera con la semilla, aplicando cada pedido justo en
   su `dSig` (si el generador no pasa exactamente por ese punto, la pista no
   es la de la semilla).
3. **Cada evento, en orden**:
   - el tiempo de juego y el reloj real no van hacia atrás, y el de juego no
     le gana al real (5 % + 0,4 s de holgura);
   - entre dos eventos con el corredor de pie, los metros son los que da la
     velocidad (1 % + 1,5 m);
   - una estrella o un 2× existen en la pista con ese número, no se usaron
     antes y estaban a menos de 1,3 m (en el juego se recogen a 1 m);
   - el 2× dura lo que dice su nivel (±0,15 s, más un cuadro por cada choque
     con el 2× puesto, porque el cuadro del choque no lo gasta);
   - el +5 se usa una vez, en los primeros 6,5 s;
   - entre un choque y «seguir corriendo» no hay puntos, y los metros solo
     resbalan lo que da la caída (12 m como mucho).
4. **Lo declarado**: los puntos (±2 por redondeo), los metros (±1) y el
   tiempo (±0,1 s); y que la prueba sea de esa cuenta.

El juego se revisa a sí mismo con `rehace` antes de mandar: si su propia
prueba no cuadrara (sería un error del juego) no la manda, lo dice en el
resumen y avisa en la consola, en vez de mandar algo que el club castigaría
como trampa.

### Lo que hace el juego con una carrera que no vale

- Si se usó un gancho de `__metrorush` que cambia la carrera, o hubo teclas
  de un script: la carrera se juega igual, pero no se manda. El resumen lo
  dice («Partida de prueba…»). Leer (`estado`, `prueba`, `desglose`) o fijar
  la calidad gráfica no cuenta.
- Si se cierra la pestaña con la carrera en pausa, se cierra con su choque
  en ese punto (la prueba no queda sin final).

## 4. `sospecha()` (filas guardadas sin prueba)

No son umbrales de «raro»: son lo que el juego no deja hacer.

- Distancia: más metros que la integral de la velocidad en ese tiempo
  (+15 m). En un minuto se corren unos 1 127 m.
- Carrera: más de 1 280 puntos por metro posible (el multiplicador máximo es
  (30 + 29 + 5) × 2 = 128).

## 5. Pruebas

`colabtex/tests/antitrampas-metrorush.test.cjs`: un robot que corre cuadro a
cuadro como `juego.js` (cuadros de 8 a 50 ms, la velocidad del motor, la
pista de la semilla, recoge las estrellas y los 2× a menos de un metro, la
mochila con su cinta, un túnel, choques y «seguir corriendo», tres choques
con el mismo 2× puesto) y lleva los puntos por su cuenta, cuadro a cuadro.
Sus carreras pasan y el verificador da sus mismos puntos. Se rechazan: el
resultado sin prueba, los puntos, metros o tiempo inflados, la prueba de
otra cuenta, una estrella que no está, recogida lejos o dos veces, el 2×
estirado, un base imposible o más alto que el de verdad, el +5 tarde, las
entradas sintéticas, otra semilla, un pedido corrido, la cámara rápida, los
metros de más y el tiempo recortado.

Además se jugaron carreras en Chromium: una corta con teclas de verdad y un
choque natural, otra con un choque, «seguir corriendo» pagando y otro
choque, y una larga (despegue, +5, dos túneles, terminada desde la pausa).
El verificador del club aceptó las tres pruebas y dio exactamente los puntos
del juego (2 395, 10 279 y 388 182).

## 6. Límite honesto

- **El multiplicador base sale del progreso**, que guarda la propia cuenta
  (`users/<uid>/club/metrorush` y `localStorage`), como las rachas antes de
  `rachasClub`. Quien lo edite antes de empezar corre con ese base, y la
  prueba lo dice; el verificador solo acota 1–30. Cerrarlo pediría llevar el
  nivel de misiones en un nodo que las reglas cuenten.
- **No se prueba el carril**: que el corredor estaba en el carril de la
  estrella, ni que esquivó lo que esquivó. Una prueba fabricada podría
  recoger todas las estrellas y 2× de la pista; hay una estrella cada
  420–580 m y un poder cada 300–520 m (un cuarto son 2×), así que lo que se
  gana así está acotado.
- **Un cliente reescrito** puede saltarse las marcas de «de prueba» y fabricar
  una prueba coherente jugando él mismo: es el límite de todo lo que corre en
  el navegador (ver `docs/antitrampas.md`).
