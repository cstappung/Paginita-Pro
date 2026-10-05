# Antitrampas de FANAL

Categorías: `club-fanal-travesia` y `club-fanal-sinfin` (puntos) y
`club-fanal-jornadas` (la jornada más lejana completada; 13 es el final).

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

`{v:1, m:"t"|"s", id, u, k, J:[registro…], x?}`. `id`: semilla de la
partida (de ella sale el valor de cada Mensajera, `M.valorMensajera`).
`u`: la cuenta. `k`: jornadas heredadas de un punto de control. Cada
registro: `{n, t (cs de juego), r (cs reales), g (ms en juego), e
(eventos), p (pulsos), f ("c"|"m"|"a"|"f"), s (puntos), v (llamas), b
(entradas sintéticas), d (entradas del mando), h (hash encadenado)}`.

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

- Cadena de hash, orden de jornadas desde la 1 (o la 14 en el sin fin), lo
  heredado termina al empezar un acto.
- Puntos y llamas exactos por jornada: Resonancia, bonus, llamas extra,
  Mensajera con semilla. Lo declarado = lo recalculado; tiempo declarado =
  suma de `g`; modo = categoría; cuenta = `u` (si la página pasa `ctx.uid`).
- Mecánica: cada formación completa con sus polillas exactas, las de dos
  vidas necesitan un roce, el jefe necesita su vida en daño, el Alba tarda
  ≥ 59 s, 24 lumbres, ninguna polilla antes de 1 s ni jefe antes de 2,5 s,
  muerte ⇔ llamas en 0, cada acierto con un tiro anterior (≤ 3 s de vuelo,
  tope de cosas por bala salvo con la lente), tiros a ≥ 0,14 s (el fanal
  espera 0,16), cada tiro afinado a ≤ 125 ms de un pulso anotado.
- Reloj: juego ≤ real × 1,1 + 2 s por jornada (cámara rápida).
- Bots: `b > 0` (eventos con `isTrusted` falso sin mando conectado)
  rechaza; las del mando (`__mando` con un gamepad conectado) valen. Ritmo
  humano: oleada ≥ 3 s + 0,25 s por polilla a balazos (mitad con pabilo,
  nada con lente), jefe ≥ 8 s, media ≥ 20 s por jornada con 4 o más,
  travesía entera ≥ 300 s. Márgenes de 2–4× sobre lo honesto.
- `__fanal`: cualquier uso (también leer `mundo()`/`teclas`) marca la
  página; ninguna partida de ahí en adelante se manda, el panel final lo
  dice, y un punto de control guardado así lleva `x:1` y la prueba lo
  rechaza. Los ganchos siguen funcionando para probar.

`sospecha()`: sin fin > 1000 pts/s; jornadas del sin fin a < 8 s cada una;
jornada 13 en < 60 s + 8 s/jornada; travesía > 300 000 puntos o > 2000
pts/s. Marca las dos filas reales de arriba y deja las honestas.

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
bot que dispara cada 0,17 s sin fallar. Además, una partida real jugada en
Chromium con teclas de verdad (3 jornadas) pasa, y editada no. A mano en
Chromium: continuar desde un punto de control pasa; teclas despachadas por
script (`dispatchEvent`) se rechazan; usar `__fanal` no manda nada.

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

- Probar en Chromium una travesía completa real (el bot ciego no pasa de
  la jornada 3); los jefes y el Alba están cubiertos solo por el robot.
- Calibrar los mínimos de ritmo con pruebas reales cuando haya datos.
