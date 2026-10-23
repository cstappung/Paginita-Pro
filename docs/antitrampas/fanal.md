# Antitrampas de FANAL

Categorías: `club-fanal-travesia` (puntos) y `club-fanal-jornadas` (la
jornada más lejana completada; 8 es el Alba, 14 la Hoguera, 20 el Sol, y
desde ahí la travesía sigue sin fin). `club-fanal-sinfin` queda con las
marcas de antes de la versión 4 y no recibe ninguna nueva.

**Versión 4** (octubre de 2026): un solo modo. La historia son veinte
jornadas (una oleada y un jefe por acto) hasta el Sol, y después sigue sin
fin con los jefes en fase 2 a 5 (el verificador admite `V` en cualquier
jefe en fase 3 o más; el Sol suelta larvas, `O`). Ya no hay puntos de control: toda prueba
empieza en la jornada 1 (`m:"t"`, `k:0`, o se rechaza). Retomar una
travesía guardada (la página se cerró, o «Salir» en la pausa) sigue la
**misma** prueba: el punto guarda la prueba hasta la jornada que empezaba,
y el juego la rehace con `rehace` para recuperar puntos, llamas, mejoras,
brasas y notas. Una llama perdida en la jornada a medias viaja como
`perdidas` y se vuelve a anotar (`g`) al retomarla, así que salir no
devuelve llamas. El tiempo declarado es el de toda la travesía. Las
pruebas de la 3 se rechazan como de otra versión (no castiga), y el iframe
subió a `club-47`.

**Las habilidades de las fases 2 y 3** (rediseño de octubre de 2026, sin
cambio de versión: `prueba.js` y el verificador son los mismos). Cada jefe
tiene una habilidad propia por fase, y todas caben en los eventos que ya
había: los huevos de la Nidada (Nodriza) son larvas, `O`; las balizas del
Faro, el fuego fatuo del Casco (solo fase 3) y los fanales que la Hoguera
arroja pagan como lo que orbita, `V`. Lo demás que un tiro rompe (la seda
de la Crisálida, su red, los espejismos de la Esfinge) **no anota evento,
ni acierto, ni puntos, ni nota**, igual que un tiro perdido, y mientras
dura no hay `X`: el daño declarado al jefe nunca supera el de sus balas.
Las «espinas» que nombra el comentario de `V` en `prueba.js` ya no
existen; la regla que las admitía (cualquier jefe en fase 3) es la que usa
el fuego fatuo.

**La fase 4** (octubre de 2026, también sin cambio de versión). Desde la
tercera vuelta del sin fin (jornada 58) `M.jornada` devuelve `fase: 4`. El
verificador solo mira la fase para admitir `V` (`fase >= 3`), así que nada
cambia para él, y **la vida del jefe es la de la fase 3**
(`VIDA_FASE[4] === VIDA_FASE[3]`, con un test que lo cuida): si subiera,
una partida jugada con el `motor.js` anterior (en caché) moriría el jefe
con «menos daño del que aguanta» y se rechazaría. Subirla exige cambiar la
versión de la prueba y `club-N`. Sus habilidades usan lo que ya había: las
polillas del Reclamo son larvas de la Nodriza (`O`), el Ocaso del Sol se
sostiene con golpes normales (`X`), y un tiro disparado dentro de la
Mortaja de la Crisálida queda anotado como un disparo que no dio en nada.

**La fase 5** (octubre de 2026, sin cambio de versión). Desde la cuarta
vuelta (jornada 76) `fase: 5`, con la vida de la fase 3 por lo mismo
(`VIDA_FASE[5] === VIDA_FASE[3]`, también en el test). Las polillas del
Abrazo (Nodriza) son larvas (`O`) aunque no quemen; las luces del Prisma
(Faro) y sus astillas son escamas, que un tiro anula sin anotar nada; lo
demás (Acertijo, Escora, Compás, Yesca, Rayo de luna, Aurora, Amanecer)
no se rompe a tiros. **La música acelera con la fase** (`epmDeFase` en
`musica.js`: +4 % por fase, con techo `EPM_TECHO = 560` corcheas por
minuto), y los tiros afinados se juzgan contra sus pulsos. El techo deja el
pulso más corto (dos corcheas) en ≥ 0,214 s, por encima de los 0,2 s con
que el verificador cuenta pulsos «juntos» (`pulsosJuntos`): una partida
afinada en la fase 5 no parece un programa.

**La fase 6 y su rigor** (octubre de 2026, sin cambio de versión). Desde
la quinta vuelta (jornada 93) `fase: 6`, y cada vuelta en ella sube un
`grado`. El rigor solo toca lo que el verificador no mira (fuego, balas,
puntería, picadas, marcha, velocidad de las escamas, furia): la formación y
la vida de cada polilla no cambian (un test lo cuida). El jefe tiene en
pantalla más vida que la que pide el verificador (`M.vidaJefeJuego`, +22 %
por grado), y **el verificador sigue usando `M.vidaJefe`** (la de la fase
3, `VIDA_FASE[6] === VIDA_FASE[3]`): es una cota inferior, así que nunca
rechaza a quien jugó y una partida a medias del motor anterior sigue
valiendo. Romper la Muda de la Nodriza es `V`; los vidrios de la Vidriera
no anotan nada. `antitrampas-fanal.test.cjs` juega un robot hasta la
jornada 112 con los jefes aguantando su vida de pantalla, y pasa.

**Límite de tamaño, de antes de la fase 6.** Con la densidad de eventos
del robot, una travesía llega al tope de `verificaClub` (200 000
caracteres) hacia la jornada 92 aun quitándole todos los pulsos
(`FP.ajusta`), y la de 110 ya no cabe (206 kB sin fase 6, 212 kB con ella).
Una travesía real muy larga puede no entrar en la tabla aunque sea
honesta. Arreglarlo pide comprimir la prueba (otra versión y `club-N`).

**Versión 2 de la prueba** (octubre de 2026): la travesía se alargó a una
segunda parte y después sin fin, cada jornada da una brasa que se gasta en
mejoras del arma y del fanal (`motor.js`: `MEJORAS`, `compra`, `armas`,
`nave`), y los augurios endurecen cada jornada. Cada registro lleva las
compras del taller (`u`) y el verificador las vuelve a hacer con la misma
`M.compra`; los límites mecánicos (espera entre tiros, cosas por tiro,
daño, golpes de un jefe, ritmo por polilla) salen de `M.armas` con esas
mejoras. Una prueba de la versión 1 se rechaza como «de otra versión del
juego» (caché, no trampa: no castiga), y el iframe subió a `club-42`.

**Versión 3** (octubre de 2026): las brasas solo se ganan venciendo a un
jefe, y el sin fin empieza con una por jefe de la historia (7). Una prueba
de la versión 2 compraba con la brasa de cada jornada, así que ya no
cuadra: se rechaza como de otra versión (no castiga), y el iframe subió a
`club-44`. Un punto de control guardado con la 2 se sigue jugando, pero
no cuenta.

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

`{v:4, m:"t", id, u, k:0, J:[registro…], x?}`. `id`: semilla de la
partida (de ella sale el valor de cada Mensajera, `M.valorMensajera`).
`u`: la cuenta. `k`: 0 (era lo heredado de un punto de control). Cada
registro: `{n, t (cs de juego), r (cs reales), g (ms en juego), e
(eventos), p (pulsos), f ("c"|"m"|"a"), s (puntos), v (llamas), b
(entradas sintéticas), d (entradas del mando), u (compras del taller antes
de la jornada: una letra por brasa, `cfpbrvoi` las mejoras y `l` una
llama), h (hash encadenado)}`. El cruce con el Alba es el evento `f` de la
jornada 8, que se cierra `c`: la travesía sigue.

`e` es una letra por evento y las centésimas desde el anterior; los que
vienen de una bala llevan además cuántos tiros atrás salió (base 36):
`S/T` tiro (T afinado), `ABC` polilla apagada, `N` roce a una de dos vidas,
`GHI` destello, `JKL` picada quemada, `O` larva, `Q` lumbre, `R` sombra,
`V` órbita del Faro, `X` golpe al jefe, `Z` al Alba, `M` Mensajera, `g`
llama perdida, `j` jefe muere, `f` cruce, `q` lumbre acogida, `plcad`
poderes, `z` latencia del audio. `p`: los pulsos de la música (deltas en
base 36). Una travesía entera ocupa 10–16 kB.

La travesía guardada lleva la prueba hasta ahí (`punto.pr`, la conserva
`mezclaProgreso`, junto con `punto.ver`); al retomarla, la prueba sigue
desde ahí. Un punto de otra versión se descarta al cargar.

## Qué verifica (`rehace` + `verifica/fanal.js`)

- Cadena de hash, orden de jornadas desde la 1, `k` = 0.
- El taller: cada compra con brasas que había (una por jefe vencido), sin
  pasar del nivel 3, la llama solo si cabe.
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
el sin fin gasta sus 7 brasas). Además, una partida jugada en Chromium
por el juego de verdad (un bot que lee el mundo con `__fanal`, con el reloj
real simulado y sin eventos de entrada; la marca `x` se le quita para la
prueba) con la versión 2 se rechaza ahora como de otra versión, igual que
la de la versión 1; lo que se comprobaba sobre ella (afinados convertidos,
una compra sin brasas, puntos inflados) se comprueba sobre el robot. A mano en
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
