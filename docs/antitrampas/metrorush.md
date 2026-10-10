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
  `15 + 0,1·t` m/s con tope en 50 (`M.velocidad`, con la curva en `M.VELOCIDAD`). Entre dos instantes se corre su
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
     resbalan lo que da la caída (de 50 m/s a 0, 20,8 m, más 2 de holgura).
4. **Lo declarado**: los puntos (±2 por redondeo), los metros (±1) y el
   tiempo (±0,1 s); y que la prueba sea de esa cuenta.

El juego se revisa a sí mismo con `rehace` antes de mandar: si su propia
prueba no cuadrara (sería un error del juego) no la manda, lo dice en el
resumen y avisa en la consola, en vez de mandar algo que el club castigaría
como trampa.

### Los modos (`m`)

Cada modo de juego (`MODOS` en `motor.js`) tiene su tabla:
`club-metrorush-carrera` (clásico), `-puro` (Sin ayudas), `-sinmonedas`,
`-city` y `-citypuro`. La distancia tiene una tabla por mundo (`DISTANCIA`
en `motor.js`): `club-metrorush-distancia` recibe el clásico, Sin ayudas y
Fantasma; `club-metrorush-citydistancia`, City, City sin ayudas y City
fantasma. Los dos modos Fantasma no tienen tabla de puntos: anotan solo en
la de distancia de su mundo. La prueba lleva el
modo en `m`, salvo el clásico, que no lo anota: su prueba es la misma de
antes de los modos y `VERSION` sigue en 2. `rehace`:

- regenera la pista con ese modo (`crearGenerador(s, {modo})`) y mide los
  metros con su curva (`velocidadDe(modo)`);
- rechaza un `m` que no existe, y lo que el modo no permite: un 2× (`d`)
  o la cinta de la mochila (`C`) sin poderes, el +5 (`p`) sin
  potenciadores, «seguir corriendo» (`s`) sin segunda oportunidad, un
  boleto (`B`) que ese mundo no tiene.

El verificador además exige que la tabla sea la del modo de la prueba (una
carrera del clásico, con sus poderes, no entra en «Sin ayudas»), que una
tabla de distancia reciba solo los modos de su mundo, y que una carrera
fantasma vaya únicamente a la tabla de distancia (con `puntos` = metros). `sospecha` usa el multiplicador máximo de cada
modo: sin poderes ni potenciadores es 30 + 29 = 59 (590 puntos por metro).

Los modos Fantasma corren la pista del récord que persiguen: el n.º 1 de
la tabla de distancia de su mundo, venga del modo que venga (normal, sin
ayudas o fantasma). Por eso la carrera fantasma corre **con las reglas del
fantasma**: `M.conReglas(modoFantasma, reglas)` arma un modo compuesto (las
reglas de pista, poderes y multiplicador del modo de quien puso el récord,
más «fantasma»), y la prueba lo dice en `pm` (el modo cuyas reglas usó) y en
`v` (la versión de pista: la 2, con tope de 50/46 m/s, o la 3, con 60). Así
la pista es idéntica a la del récord y `rehace` la regenera con esas mismas
reglas. La semilla se puede elegir y el verificador acepta cualquiera (la
pista sale de ella). La carrera se compara en metros (`metrosEn`), no en
puntos: con reglas de otro modo los puntos no serían comparables. La
prueba puede traer `g`, el rastro del fantasma (carril y altura en texto):
`rehace` no lo usa para los puntos, solo exige que sea texto de a lo más
`MAX_FANTASMA` = 60 000 caracteres; la prueba entera sigue con el tope del
club de 200 000 (`PRUEBA_MAX`).

#### El rastro del fantasma (`g`) y por qué no es una vía de trampa

El rastro lo graba `juego.js` solo en los modos fantasma (`fantasma.js`):
una muestra cada 0,1 s de juego con el carril (`x`, al décimo de metro), la
altura (`y`, a los 15 cm) y qué hacía el corredor (corre, sube, baja,
rueda, tropieza), tres letras por muestra y las repetidas juntas («.», «~c»).
Empieza con la versión («1»). Una carrera de 10 minutos ocupa de 2 a 18 kB.

**El rastro no da ni quita puntos, y nunca decide un récord.** Es solo lo
que ve quien corre después: el puntaje del fantasma sale de sus eventos
(estrellas, choque) con la misma cuenta que `rehace`, y su pista de su
semilla y sus pedidos. Por eso `rehace` solo revisa lo burdo, que no es de
esta carrera:

- que se pueda leer (`F.duracion(g) ≥ 0`: la versión, letras del alfabeto,
  un estado de 0 a 4, ninguna repetición antes de la primera muestra; una
  ficha cortada al final, por el recorte a `MAX_FANTASMA`, se acepta);
- que no dure más que la carrera, con 2 s de holgura (`duración ≤ t(f) + 2`).

Nada más: un rastro que «atraviesa» un tren o salta donde no hay nada no se
rechaza, porque no hay nada que ganar con eso (no suma puntos, y el que
corre contra él solo pierde si lo imita). Si el propio juego graba un rastro
que no pasa esas dos reglas (un error nuestro), `cierraPrueba` lo saca y
manda la carrera sin él: el récord vale igual, solo que no se podrá ver
correr.

Correr contra el fantasma no cambia nada para el verificador: la carrera
usa la semilla del fantasma y aplica sus túneles y boletos (`T`, `B`) en el
mismo `dSig` en que él los pidió, para que la pista sea idéntica; la prueba
los anota como propios y `rehace` los repite como cualquier otro pedido. El
fantasma llega de la página (`solo/club.js`, mensaje `fantasma-pedir`): la
fila 1.ª de la tabla y su prueba, leída **por clave**
(`soloPruebas/<cat>/<uid>/<partida>`, la regla ya lo permitía) y guardada
por visita, y el juego la vuelve a pasar por `rehace` antes de correr contra
ella; si no cuadra (otra versión, otro modo), se corre solo. `VERSION` no
cambió: `g` es opcional y las pruebas sin él se leen igual.

En «Sin monedas» tocar una moneda es un choque (`m`). Que el choque fue
contra una moneda no se prueba —no se prueba el carril—, pero un choque
solo resta puntos: no hay trampa ahí.

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
  (+15 m). En un minuto se corren 1 080 m.
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

`colabtex/tests/metrorush-fantasma.test.cjs`: el rastro de ida y vuelta (los
carriles justos, las repeticiones de más de 65), el tope (10 minutos del
peor caso bajo `MAX_FANTASMA`, uno recortado se sigue leyendo), la
interpolación, una carrera con rastro que se rehace con los mismos puntos
que sin él, el rastro ilegible o más largo que la carrera rechazado, los
puntos del fantasma metro a metro iguales a `rehace`, `prepara`, y que un
perseguidor con otro ritmo de cuadros y otros boletos corre la MISMA pista
que el fantasma (con `generaPista`, `pideTunel` y `pideBoleto` sacadas tal
cual de `juego.js`) y su prueba se rehace.

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
