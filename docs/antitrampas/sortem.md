# Antitrampas de sortEm

## Vías encontradas

1. `Club.result({categoria:'club-sortem-10',puntos:10,tiempo:1})` desde la consola.
2. Editar `jg.club.pendientes.*` en `localStorage`.
3. Tocar el estado: `gameState` es global (`gameState.m.bloques = …`), y
   `handlePlayingInput`/`handleKeyInput` se pueden llamar a mano.
4. El reloj: el tiempo salía de `Date.now()`; sobrescribirlo (o
   `performance.now`) daba cualquier marca. Un *speedhack* lo comprime.
5. Bots: `dispatchEvent(new KeyboardEvent(...))` en bucle, o un programa
   del sistema (AutoHotkey, xdotool) que aprieta teclas de verdad.

## La prueba (v1)

`Club.result(dato, gameState.prueba())`, ~400 caracteres en el de 10:

| campo | qué es |
|---|---|
| `v`, `n`, `s` | versión, modo (10/20), semilla uint32 del reparto |
| `d`, `w` | `Date.now()` al empezar; ms de reloj de pared hasta ganar |
| `a` | una letra por tecla que llegó al tablero: `L`, `R`, `A`; minúscula = autorrepetición (`ev.repeat`) |
| `t` | instante de cada una (diferencia con la anterior), del `event.timeStamp` |
| `f` | origen: `.` teclado real (`isTrusted`), `m` evento de `mando.js` con mando conectado, `u` sintético sin mando |
| `k` | ms que se mantuvo cada tecla (keyup − keydown), `-1` si no se supo |

El reparto ya no usa `Math.random`: `juegos/club/sortem/motor.js` (UMD
`SortemMotor`, puro) reparte con mulberry32 y aplica cada tecla. `game.js`
juega **a través** del motor (`GameState.juega` → `SortemMotor.aplica`) y
el verificador rehace con el mismo archivo, así que no pueden divergir.
El tiempo es el `timeStamp` de la tecla ganadora menos el de la tecla que
empezó (ni la tasa de cuadros ni una pestaña frenada lo cambian); si el
reloj de pared vio más de 1,5 s + 3 % de más (portátil dormido o
`performance.now` frenado), cuenta el de pared (`tiempoDe`).

## Qué verifica (`colabtex/src/juegos/solo/verifica/sortem.js`, `PRUEBA = 1`)

1. Forma, modo y puntos; rehace la partida: tiene que quedar ordenada
   justo en la última tecla, sin teclas después.
2. `tiempo === tiempoDe(Σt, w)`.
3. Una sola tecla `u` → rechazo (script).
4. Límites humanos: primera tecla ≥ 150 ms; total ≥ 1,5 s (10) / 5 s (20);
   10 pulsaciones seguidas ≥ 300 ms; media ≥ 75 ms por pulsación. Las
   autorrepeticiones no cuentan como pulsación, pero una minúscula que no
   sigue a su misma letra sí (marcar todo como repetición no sirve).
5. Regularidad (≥ 15 intervalos): CV < 0,05 rechaza solo (metrónomo). Si
   no, rechaza una señal de las teclas (sin keyup en > 70 %, duraciones
   con CV < 0,05 o mediana < 8 ms) **junto con** CV < 0,15 o > 10
   pulsaciones/s. Rapidez y constancia solas no rechazan.

Calibración: mejores marcas reales 3,51 s (10) y 23,6 s (20), más una de
10,2 s (20) sospechosa. Un solucionador óptimo da mediana 24 teclas (16 en
repartos de suerte) en el de 10; uno codicioso, 28 y 80 (10/20). Robots
humanos simulados con intervalo típico de 80 ms a 300 ms: 1 rechazo de
5600 (un 20 de 4,95 s con ritmo de 80 ms, más rápido que nadie real).

`sospecha()` (filas sin prueba): puntos ≠ modo, o < 2,5 s (10) / < 12 s
(20): deja pasar el 3,51 s y marca el 10,2 s para revisión a mano.

## Lo que no se detecta (límite honesto)

- Un cliente reescrito o un *speedhack* que comprima ×0,5 a un jugador
  rápido: la prueba sale humana y más rápida que la real. Solo frena lo
  extremo (×0,15 se rechaza; ×0,25 de un jugador típico pasa).
- Un bot a nivel de sistema con retardos aleatorios y duraciones de
  pulsación variables.
- Repetir la misma prueba: da el mismo tiempo (no mejora el récord), pero
  cobra la partida del club otra vez.
- Configurar la autorrepetición del sistema muy rápida es legítimo.

## Cambios compartidos pedidos

- `solo/club.js`: subir `club-N` del iframe de sortEm (cambiaron
  `game.js` y hay un `motor.js` nuevo en su `index.html`, `?v=sortem-6`).
- `solo/club.js`: rechazar una prueba de sortEm cuya semilla `s` ya se usó
  en esta cuenta (repetición de prueba para cobrar partidas), y, solo en
  vivo, una con `d` de hace más de un día.
- `test:juegos` en `package.json`: añadir `tests/antitrampas-sortem.test.cjs`.

## Pendiente

- Correr `npm run test:juegos` completo (se corrieron las suites del club,
  logros, discord, salón, solo y antitrampas: verdes).
- Darle a sortEm un `Mando.configura` (hoy el mando solo mueve el cursor).
