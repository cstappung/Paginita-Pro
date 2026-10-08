# Antitrampas de FANAL

Categorías: `club-fanal-travesia` y `club-fanal-sinfin` (puntos) y
`club-fanal-jornadas` (la jornada más lejana completada; 13 es el Alba, 25
la Hoguera, y desde ahí la travesía sigue sin fin).

**Versión 2 de la prueba** (octubre de 2026): la travesía se alargó a una
segunda parte y después sin fin, cada jornada da una brasa que se gasta en
mejoras del arma y del fanal (`motor.js`: `MEJORAS`, `compra`, `armas`,
`nave`), y los augurios endurecen cada jornada. Cada registro lleva las
compras del taller (`u`) y el verificador las vuelve a hacer con la misma
`M.compra`; los límites mecánicos (espera entre tiros, cosas por tiro,
daño, golpes de un jefe, ritmo por polilla) salen de `M.armas` con esas
mejoras. Una prueba de la versión 1 se rechaza como «de otra versión del
juego» (caché, no trampa: no castiga), y el iframe subió a `club-42`.

## Vías encontradas

1. `Club.result` desde la consola con un número cualquiera.
2. `window.__fanal`: `salta(n)` empezaba en cualquier jornada, `sigue()`
   saltaba el relato, `dano`/`limpia`/`deja`/`acerca` mataban jefes,
   formaciones o traían el Alba sin jugar; `paso(dt)` adelantaba el juego,
   `mundo()`/`teclas` bastan para un bot.
3. Editar el punto de control en `localStorage` (`fanal.progreso.*`:
   `punto.puntos`, `punto.j`) y «Continuar».
4. Tocar el estado con el depurador (`P.puntos`), parchear `FanalMotor`.
5. Acelerar el reloj (`requestAnimationFrame`/`performance.now`).
6. Bots: teclas despachadas por script, o un programa que juega.
7. El valor de la Mensajera salía de `Math.random`: no se podía comprobar.

Datos reales: una cuenta con `jornadas` = 39 y 130 543 puntos del sin fin,
ambas con 55,98 s. Lo honesto: 500–800 s y 64 000–124 000 puntos por
travesía.

## Qué se eligió: prueba de coherencia, no repetición cuadro a cuadro

Repetir exacto un shooter en tiempo real con la música marcando el pulso
obliga a separar la física de 2000 líneas de dibujo y llevar el reloj de la
música cuadro a cuadro. Pero los puntos no salen del azar sino de los
eventos, así que se anota cada jornada y se recalcula con el motor.
`juegos/club/fanal/prueba.js` (UMD `FanalPrueba`) es a la vez el que anota
(lo usa `juego.js`) y el que rehace (lo usa el verificador): no divergen.

### Formato

`{v:2, m:"t"|"s", id, u, k, J:[registro…], x?}`. `id`: semilla de la
partida (de ella sale el valor de cada Mensajera, `M.valorMensajera`).
`u`: la cuenta. `k`: jornadas heredadas de un punto de control. Cada
registro: `{n, t (cs de juego), r (cs reales), g (ms en juego), e
(eventos), p (pulsos), f ("c"|"m"|"a"), s (puntos), v (llamas), b
(entradas sintéticas), d (entradas del mando), u (compras del taller antes
de la jornada: una letra por brasa, `cfpbrvoi` las mejoras y `l` una
llama), h (hash encadenado)}`. El cruce con el Alba es el evento `f` de la
jornada 13, que se cierra `c`: la travesía sigue.

`e` es una letra por evento y las centésimas desde el anterior; los que
vienen de una bala llevan además cuántos tiros atrás salió (base 36):
`S/T` tiro (T afinado), `ABC` polilla apagada, `N` roce a una de dos vidas,
`GHI` destello, `JKL` picada quemada, `O` larva, `Q` lumbre, `R` sombra,
`V` órbita del Faro, `X` golpe al jefe, `Z` al Alba, `M` Mensajera, `g`
llama perdida, `j` jefe muere, `f` cruce, `q` lumbre acogida, `plcad`
poderes, `z` latencia del audio. `p`: los pulsos de la música (deltas en
base 36). Una travesía entera ocupa 10–16 kB.

El punto de control guarda la prueba hasta ahí (`punto.pr`, la conserva
`mezclaProgreso`); al continuar, la prueba sigue desde ahí. Un punto sin
prueba (de antes de esto) se juega igual, pero no se manda.

## Qué verifica (`rehace` + `verifica/fanal.js`)

- Cadena de hash, orden de jornadas desde la 1 (o la 26 en el sin fin), lo
  heredado termina al empezar un acto (también el del sin fin, la 26).
- El taller: cada compra con brasas que había (una por jornada completada;
  el sin fin empieza con 25), sin pasar del nivel 3, la llama solo si cabe.
- Puntos y llamas exactos por jornada: Resonancia, bonus, llamas extra,
  Mensajera con semilla. Lo declarado = lo recalculado; tiempo declarado =
  suma de `g`; modo = categoría; cuenta = `u` (si la página pasa `ctx.uid`).
- Mecánica: cada formación completa con sus polillas exactas, las que
  aguantan más golpes necesitan el daño de sus roces (`N`) antes del tiro
  que las apaga, el jefe necesita su vida en daño, el Alba tarda ≥ 59 s, 24
  lumbres, ninguna polilla antes de 1 s ni jefe antes de 2,5 s, muerte ⇔
  llamas en 0, cada acierto con un tiro anterior (≤ 3 s de vuelo, tope de
  cosas por tiro según el patrón y lo que atraviesa el arma, salvo con la
  lente o el rayo del Faro), tiros a la espera del arma menos 2 cs (0,16 s
  sin mejoras, 0,095 s con la mecha corta entera), cada tiro afinado a ≤
  125 ms de un pulso anotado.
- Reloj: juego ≤ real × 1,1 + 2 s por jornada (cámara rápida).
- Bots: `b > 0` (eventos con `isTrusted` falso sin mando conectado)
  rechaza; las del mando (`__mando` con un gamepad conectado) valen. Ritmo
  humano: oleada ≥ 3 s + 0,25 s por polilla a balazos + 0,15 s por roce,
  divididos por lo que toca un tiro (sin mejoras, uno sin afinar; con
  mejoras, el que más toca: un abanico afinado que atraviesa una columna
  apilada apaga varias de un golpe; nada con lente), jefe ≥ 4 s y nunca antes de 2,5 s + sus golpes a la espera del
  arma, media ≥ 7 s por jornada con 4 o más, la primera parte entera ≥
  300 s. Márgenes de 2–4× sobre lo honesto.
- `__fanal`: cualquier uso (también leer `mundo()`/`teclas`) marca la
  página; ninguna partida de ahí en adelante se manda, el panel final lo
  dice, y un punto de control guardado así lleva `x:1` y la prueba lo
  rechaza. Los ganchos siguen funcionando para probar.

`sospecha()`: sin fin > 5000 pts/s; jornadas a < 8 s cada una desde el
último punto de control (más el minuto del Alba si lo cruza); travesía >
2500 pts/s. Ya no hay techo de puntos en la travesía: no termina. Marca las
dos filas reales de arriba y deja las honestas.

El ritmo de disparo **no** se juzga por regularidad: mantener Espacio
dispara cada 0,3 s exactos, y eso es lo normal.

## Pruebas

`colabtex/tests/antitrampas-fanal.test.cjs`: un robot a nivel de eventos
(con recuento de puntos propio) que juega travesías lentas, normales y
rápidas pero humanas (650–1450 s, ~93 000 puntos), con muerte, en el sin
fin y desde un punto de control: pasan. Se rechazan: sin prueba, puntos
inflados, tiempo recortado, otra categoría/cuenta, prueba editada (también
resellada y con puntos ajustados: tiros convertidos en afinados), jornadas
quitadas, `salta`, `dano`, `acerca`, `limpia`, tiros a 5 cs, cámara rápida,
entradas sintéticas, la partida real de la tabla (39 jornadas en 56 s) y un
bot que dispara cada 0,17 s sin fallar. El robot compra en el taller (y en
el sin fin gasta sus 25 brasas). Además, una partida jugada en Chromium
por el juego de verdad (un bot que lee el mundo con `__fanal`, con el reloj
real simulado y sin eventos de entrada; la marca `x` se le quita para la
prueba) pasa, con sus compras y evoluciones, y editada no; y la partida
real de la versión 1 se rechaza como de otra versión. A mano en
Chromium: continuar desde un punto de control pasa; teclas despachadas por
script (`dispatchEvent`) se rechazan; usar `__fanal` no manda nada.

Un error del juego que esta prueba encontró (lo vio el bot de Chromium):
si una oleada terminaba antes de que pasara su Mensajera, la que quedaba
pendiente cruzaba durante el jefe siguiente, y alcanzarla dejaba una `M`
en una jornada de jefe, que el verificador rechaza. Ahora un jefe empieza
con `mensajerasRest = 0`.

## Límite honesto

- Quien escriba un programa puede fabricar una prueba coherente (eventos,
  pulsos y tiempos plausibles) o mover sus tiros reales al pulso más cercano:
  no se sabe dónde estaba cada polilla. Lo frenan el ritmo humano y la
  auditoría posterior.
- Los relojes los mide el cliente: quien falsee a la vez `requestAnimationFrame`
  y `performance.now` pasa el control de cámara rápida. Un bot a nivel de
  sistema operativo produce entradas `isTrusted`.
- Con pabilo o lente el ritmo mínimo por polilla se relaja.

## Cambios compartidos pedidos

- `verificaClub` debería pasar `{uid}` como tercer argumento a `verifica`
  (en vivo y en `auditar-club.cjs`): la prueba lleva `u` y así una prueba
  copiada de `soloPruebas` de otra cuenta no valdría.
- Subir `club-N` del iframe en `solo/club.js` para que el juego nuevo llegue
  sin caché (los scripts del juego ya llevan `?v=` nuevos).

## Pendiente

- Probar con una persona la segunda parte entera y el sin fin: los jefes
  nuevos están cubiertos por el robot y por el bot de Chromium.
- Calibrar los mínimos de ritmo con pruebas reales cuando haya datos.
