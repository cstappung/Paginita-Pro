# Antitrampas: BBTAN

Categoría `club-bbtan-rondas`: `puntos` = ronda más alta alcanzada, `tiempo` =
tiempo jugado sin pausas (desempata, menos es mejor). Además paga
`monedasBbtan(ronda)`, así que inflar la ronda era lo más rentable del club.

## Vías que había

| Vía | Cómo |
|---|---|
| `Club.result` desde la consola | `Club.result({categoria:'club-bbtan-rondas',puntos:1209,tiempo:…})` |
| Editar la partida guardada | `bbtan-partida-v1.cuenta.<uid>` en `localStorage`, o `users/<uid>/club/bbtan` en la nube: subir `round`, vaciar `blocks`, poner 500 bolas, y seguir jugando. Era la vía más cómoda. |
| Recargar a media jugada | La partida se guardaba al empezar la ronda: un mal tiro se deshacía recargando y se probaba otro ángulo. |
| Tocar el estado | Las variables viven en un cierre (IIFE), pero el `localStorage` sí se alcanza (vía anterior). |
| Reloj | Acelerar `requestAnimationFrame`/`performance.now` solo cambia el desempate; la física avanzaba con el `dt` de cada cuadro. |
| Bot | Un script que apunta (con `dispatchEvent` o con eventos reales por CDP/xdotool) y dispara al instante, ronda tras ronda. |

Datos reales que motivan esto: hay filas de ronda 1209 (13 798 s) y 941
(19 621 s) cuando la siguiente es 436.

## Qué cambió en el juego

- **`motor.js` (nuevo, UMD `BBTANMotor`)**: todo lo que decide la partida
  —filas, bolas, choques, bonos, puntaje, bajar, perder— sin dibujo. Lo usan
  `game.js` y el verificador; `physics.js` y `rules.js` se fueron dentro.
  - **Tiempo fijo**: un tick = 1/60 s de juego. La velocidad (×1…×4) y los
    FPS solo deciden cuántos ticks caben en un cuadro.
  - **Aritmética repetible en cualquier motor de JS**: solo `+ − × ÷` y
    `Math.sqrt` (IEEE los redondea igual en todas partes). Seno/coseno
    propios (`sincos`, serie de Taylor, error < 1e-15); nada de
    `Math.sin/cos/hypot/atan2` (el test lo comprueba leyendo el fuente).
  - **Ángulo entero** (diezmilésimas de radián, `ANG_MIN…ANG_MAX`); las
    flechas mueven 350.
  - **Azar con semilla** (mulberry32): la fila de cada ronda y la dispersión
    de cada tiro salen de `mezcla(semilla ⊕ cuenta, ronda)`, así que no hay
    estado de generador que guardar.
  - **Choques por cuadrícula**: cada bola mira solo las celdas cercanas
    (los bloques siempre están en la cuadrícula). Es parte de la física, y lo que
    permite rehacer cientos de rondas en segundos.
- **La partida guardada (v2)** es el estado del motor (`exporta`) con los
  tiros hasta ahí, así que **una partida reanudada se prueba entera**.
  `importa` rechaza una guardada cuya ronda no cuadre con sus tiros (editar
  `round` ya no carga). Las de la versión 1 (sin prueba) se pueden terminar,
  pero no se reportan (aviso en pantalla) para no dejar una sospecha contra
  alguien honesto.
- **Al lanzar y al recoger** se reescribe la guardada (solo en el navegador)
  con el tiro pendiente: si se recarga a media jugada, ese tiro se juega
  entero al cargar. Ya no se puede deshacer un mal tiro recargando.
- **Se escucha `club-rechazo`** y se muestra el motivo en un aviso.

## La prueba

```json
{"v":1, "s":<semilla uint32>, "u":"<cuenta>", "t":"<tiros>", "h":"<gestos>"}
```

- `t`: un tiro por ronda, separados por comas: `ángulo.Δms[.tick]` en base
  36 (ángulo sin signo; Δms = tiempo jugado desde el tiro anterior; `tick` =
  en qué tick se recogieron las bolas a mano, si se hizo). Un tiro a medias
  o con el tablero bajando no entra.
- `h`: un gesto por tiro, `<origen><espera>.<cambios>.<duración>` en base 36:
  origen `r` ratón/lápiz, `t` dedo, `k` teclado, `m` mando conectado, `x`
  evento sintético sin mando (`isTrusted = false` y sin `__mando` con un
  mando conectado; también si cualquier apunte de esa ronda lo fue); espera
  = ms de reloj desde que el tablero quedó quieto hasta disparar; cambios =
  cuántas veces se movió el ángulo; duración = ms desde el primer cambio
  hasta disparar.
- Tamaño: ~20 caracteres por ronda; 1000 rondas < 40 000 caracteres.

## Qué verifica `verifica/bbtan.js`

1. Forma de la prueba; si la página pasa el uid (ver abajo), que `u` sea
   esa cuenta.
2. Número de tiros: `puntos` (terminada) o `puntos − 1` (dejada con *Nueva
   partida*). Instantes no decrecientes.
3. **Bots**:
   - Rechaza en el acto: un tiro con origen `x`; un tiro con otro ángulo que
     el anterior y cero cambios (en el juego el ángulo solo cambia
     apuntando).
   - Tres señales, que **solo rechazan juntas (dos de tres)** y con ≥ 15
     tiros apuntados sin mando: (A) ≥ 60 % de tiros apuntados con < 40 ms
     entre el primer cambio y el disparo; (B) mediana de la espera < 150 ms
     (tiempo de reacción simple, sin contar mirar el tablero); (C)
     coeficiente de variación de las esperas < 0,08 (metrónomo). En
     partidas humanas simuladas con ruido el CV pasa de 0,3; un clic sin
     mover el ratón dura 60–120 ms.
4. **Rehace la partida** con el motor desde la semilla, tiro a tiro
   (`juegaTiro`): ángulo válido, recogida en un tick posible, ningún tiro
   después de perder, y la ronda final tiene que ser `puntos`.
5. **Tiempo**: tras cada tiro, hasta el siguiente (o hasta `tiempo`), tiene
   que pasar al menos `ticks × 1000/240 + 400` ms (el juego no pasa de ×4 y
   el tablero tarda 0,4 s en bajar), × 0,97 − 25 ms de holgura por
   redondeo. El reloj y la física avanzan con el mismo `dt`, así que una
   partida real lo cumple siempre, en cualquier pantalla.
6. Cede el hilo cada ~40 ms (`setTimeout`): 250 rondas son ~2 s de física en
   Node, 400 rondas ~5 s.

`sospecha()` (filas sin prueba): imposible si `tiempo < (puntos−1) × 0,4 s ×
0,97` (solo bajar el tablero tarda eso); inverosímil con ≥ 30 rondas a menos
de 0,9 s por ronda (un robot que apunta sin pensar y juega a ×4 desde el
primer cuadro promedia 2 s por ronda en sus primeras 30 y 2,8 s en 120). Las
filas reales de 1209 y 941 rondas (11 y 21 s por ronda) **no** se pueden
condenar por tiempo: dependen de que exista una prueba. Sin prueba en
`soloPruebas`, la regla nueva ya no las deja reescribir; borrarlas o no es
decisión de un administrador.

## Cómo se probó

- `colabtex/tests/antitrampas-bbtan.test.cjs` (8 pruebas, ~8 s): robots que
  juegan con el motor (prueban 8 ángulos sobre una copia y eligen) pasan:
  dejada a medias en la ronda 41, perdida, lenta (horas entre tiros), al
  mínimo de tiempo posible, con recogidas a mano (incluida la del tick 0),
  reanudada desde la guardada con un tiro pendiente; humanos simulados con
  ruido (ratón, dedo, teclado, mando, uno muy rápido con reacción de
  90–170 ms) pasan. Se rechazan: sin prueba, prueba vacía, ronda inflada
  (+1, +200), tiempo recortado, otra semilla, otra cuenta, tiros pegados
  tras perder, tiros cada 100 ms, instantes hacia atrás, ángulo fuera de
  rango, recogida imposible, prueba ilegible, partida guardada editada (más
  bolas y bloques con 1 de vida desde la ronda 10: el robot llega a la 40
  sobre el tablero falso y la partida verdadera no), bot con reacción fija
  y apunte instantáneo, bot con poca variación, eventos sintéticos, ángulo
  que cambia sin apuntar. También: tiros repartidos en cuadros de dt y
  velocidad variables dan el mismo estado que el tiro rehecho.
- En Chromium (Playwright, iframe con el mismo origen que hace de página de
  Juegos): partidas jugadas con ratón real, recargadas entre rondas y a
  media jugada (el tiro pendiente se jugó al cargar, ronda 7 → 8; en otra,
  ese tiro perdía y se mostró el final con su reporte), reportadas con
  *Nueva partida*; las pruebas que mandó el juego pasan el verificador en
  Node (la física del navegador y la de Node coinciden). Un Espacio
  despachado con `dispatchEvent` sale `x` y se rechaza.
- `npm run build` compila; `juegos-app.js` crece ~12 KB (motor + verificador).

## Límite honesto

- **Un bot con eventos reales y ritmo humano**: si apunta con varios
  movimientos, tarda como una persona y varía, pasa. La física es barata de
  simular, así que un bot puede buscar el mejor ángulo; lo único que lo
  frena es el ritmo.
- **Volver atrás a mano**: copiar la partida guardada antes de un tiro y
  pegarla después sigue permitiendo reintentar (la prueba resultante es una
  partida válida). La nube solo se escribe al empezar cada ronda; un tiro a
  medias en un dispositivo y la partida abierta en otro también vuelven al
  principio de esa ronda.
- **Elegir semilla**: el cliente la elige; puede probar semillas fáciles
  (igual tiene que jugar esa partida).
- **Prueba copiada**: `soloPruebas` lo lee cualquiera con sesión. Sin el uid
  del lado del verificador, una prueba ajena con su `u` intacto pasa (es una
  partida válida, aunque de otro). Con el cambio pedido abajo, no.
- La espera y la duración del gesto las mide el propio cliente: un script
  que reescriba `game.js` puede inventarlas.

## Cambios compartidos pedidos

1. **Pasar el uid al verificador**: `verificaClub(juego, dato, prueba)`
   llama `v.verifica(dato, prueba)`; BBTAN acepta un tercer argumento
   `{uid}` (o `dato.uid`) y entonces exige `prueba.u === uid`. Hace falta
   en `verifica.js` (`v.verifica(dato, prueba, {uid})`), en `solo/club.js`
   (en vivo y al re-verificar lo pendiente) y en
   `scripts/auditar-club.cjs` (el uid sale de la ruta). Es lo que cierra la
   prueba copiada de otra cuenta.
2. **Subir `?v=club-N` del iframe** en `colabtex/src/juegos/solo/club.js`
   (`frame.src`): `physics.js` y `rules.js` ya no existen y `game.js`
   cambió (`?v=bbtan-10`, `motor.js?v=bbtan-1`).
3. **CLAUDE.md**, sección de BBTAN: mencionar `motor.js` (tiempo fijo,
   aritmética repetible, choques por cuadrícula, partida guardada v2 con la
   prueba, tiro pendiente al recargar).
