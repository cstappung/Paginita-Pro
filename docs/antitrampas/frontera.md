# Antitrampas: Frontera Batalla

Categorías: `club-frontera-(torre|palacio|fabrica)-(50|abierto)` (la mejor
racha) y `club-frontera-victorias` (victorias acumuladas, paga 3 🪙 cada una).
Verificador: `colabtex/src/juegos/solo/verifica/frontera.js` (`PRUEBA = 1`).
Lo que comprueba vive en el motor, `colabtex/src/juegos/pokemon/frontera-motor.js`
(`compruebaPrueba`), el mismo que arma la prueba. Pruebas:
`colabtex/tests/antitrampas-frontera.test.cjs`.

## Vías de trampa que había

La Frontera no es un iframe del club: `frontera.js` subía a la tabla lo que
dijera su propio estado, que vive en `localStorage` (`frontera.<uid>`) y en
`users/<uid>/club/frontera` (los dos se editan a mano).

| Vía | Cómo | Ahora |
|---|---|---|
| Editar `datos.mejor` / `datos.victorias` | Al abrir la Frontera, `mira()` «reparaba» la tabla subiendo lo local si era mayor | Ya no se sube nada que solo diga `datos`. Sin prueba no hay subida |
| Editar `datos.pend` | Lo pendiente se subía tal cual | Lo pendiente lleva su prueba y se verifica. Lo viejo, sin prueba, se descarta |
| Editar la racha en curso (`r.n = 500`, el equipo, `ultimoRival`) | El siguiente combate ganado subía la racha `n` | La prueba trae los `n` combates y se vuelven a jugar todos. Los equipos de la Fábrica se rehacen desde la semilla |
| Parchear el simulador de la página (`PokeMotor.Dex…`, `PokeMotor.frontera.iqDe = () => 0`, los rivales a nivel 1) | Una línea de consola: se gana con trampa y la prueba dice la verdad sobre lo jugado | El verificador juega en un **Worker** con su propia copia de `juegos-pokemon.js`: el combate trucado no se gana en la copia limpia |
| Equipos imposibles (`>4` movimientos) | El formato libre del simulador admite 24 | `validaFrontera` lo refuta (también al elegir) y el verificador también |
| Contar dos veces la misma victoria en el total | — | Cada victoria tiene un **ordinal** que entra en la semilla de su combate (ver abajo) |
| Bots: clics de script, ritmo inhumano | `dispatchEvent` sobre los botones, o un programa que juegue | Cada elección anota su intervalo y si el clic fue de persona, de mando o de script |
| Un bot que simula los combates fuera y fabrica la prueba | Programar | **No se detecta**, salvo por el ritmo (ver «Límite honesto») |

No hay ganchos de depuración propios (`window.__…`). El «gancho» era
`globalThis.PokeMotor`, y lo resuelve el Worker.

## La prueba

Todo combate sale de la semilla de la racha (12 hex), del número de combate y
del ordinal. Rival, equipo rival, la semilla de Showdown y cada decisión de la
IA se derivan de ahí (`nuevaPelea` es determinista). Así que basta con lo que
puso el jugador.

**Racha** (`club-frontera-<inst>-<nivel>`, `partida` = `<semilla>-<n>`):

```js
{ v: 1, k: "torre-50", s: "a1b2c3d4e5f6",
  e: "<equipo empaquetado de Showdown>",   // Torre y Palacio
  t: "024",                                 // Fábrica: cuáles de los 6 de alquiler
  b: [[o, "11b2c", "", "9j.ab.m3.b3"], …] } // por combate ganado
```

Cada combate es `[ordinal, elecciones, cambio, toques]`:

- **Elecciones** compactas: `move N` → `"N"`, `switch N` → `"a"…"f"`. Lo
  raro va como array.
- **Cambio**: en la Fábrica, `"ab"` = el tuyo `a` por el `b` del rival
  anterior; `""` si no hay.
- **Toques**: un token por elección, `"."` entre tokens. Cada token es el
  intervalo en centésimas, en base 36, desde la elección anterior (o desde que
  se abrió el combate). Prefijo `m` = clic del mando (sintético de
  `mando.js` con un mando conectado). Prefijo `!` = clic de script.

Tamaño medido: unos 70 caracteres por combate (10 combates de la Torre = 702
caracteres con el equipo). Los 200 000 dan para unos 2 500 combates seguidos.
Una racha más larga no se sube, y se avisa en pantalla sin acusar a nadie.

**Victorias** (`club-frontera-victorias`, `partida` = `fv-<último ordinal>`):

```js
{ v: 1, b: 37, h: 120,              // la fila de la tabla: puntos y último ordinal contado
  q: ["<equipo>", …],               // equipos, sin repetir
  l: [["torre-50", semilla, n, o, iq, "elecciones", "toques"], …] }  // ≤ 300
```

El total acumulado no cabe entero en una prueba. Por eso la prueba trae solo
las victorias que la tabla aún no cuenta, encima de la fila que la pantalla
**leyó de la base** (`watch`, no `datos`):

- `puntos` = `b` + cuántas trae.
- Cada victoria tiene un **ordinal** `o > h`. La pantalla lo reparte al
  empezar cada combate (`1 + max(datos.oMax, h)`), y `h` viaja en la
  `partida` de la fila (`fv-<h>`). El ordinal entra en la semilla del
  combate (`semillaPelea(semilla, n, o)`). Una victoria ya contada no vuelve a
  entrar, porque su ordinal no pasa de `h`. Cambiarle el ordinal da otro
  combate, que habría que volver a ganar.
- Las victorias que no se pudieron subir esperan en el libro `datos.vl` (con
  su equipo y sus toques) hasta que la tabla las cuenta.

## Qué verifica

`compruebaPrueba(dato, prueba, desde)`, primero lo barato y al final los
combates:

1. La forma: versión, semilla, categoría = `k`, `partida` exacta, `puntos` =
   combates (o `b + l.length`), ordinales enteros, `o > h` y sin repetir,
   ninguna victoria repetida.
2. **Tiempo**: la racha no dura menos de 1 s por combate. Es el suelo que
   `cierraPelea` aplica desde la primera versión, así que ningún honrado
   baja de ahí.
3. **Equipos**: tres, legales para la Frontera (`validaFrontera`: sin
   legendarios mayores ni singulares, especie y objeto sin repetir, sin
   Mega/Z, 1–4 movimientos). Se fuerzan al nivel de la instalación, diga lo
   que diga el set. En la Fábrica el equipo se rehace desde el alquiler y
   cada cambio desde el rival recién vencido. Un cambio fuera de la Fábrica,
   antes del combate 2 o que deje repetidos, rechaza.
4. **Ritmo humano** (`ritmoHumano`, sobre todos los toques de la prueba):
   - Un clic de **script** (`isTrusted` falso, sin mando conectado) rechaza.
     Ni el ratón, ni el dedo, ni Intro sobre el botón dan uno.
   - **Menos de 100 ms** desde la elección anterior es imposible. Tras cada
     elección el turno se anima con el menú escondido, y la reacción visual
     simple ya ronda los 200 ms. Se toleran el 5 % (mínimo dos), por si el
     reloj del aparato salta.
   - Con **15 elecciones o más**, una **mediana < 350 ms** rechaza. Elegir
     entre 4–6 opciones cuesta medio segundo largo (Hick-Hyman), sin contar
     la animación.
   - Con **20 o más**, un **metrónomo** (coeficiente de variación < 0,08)
     rechaza solo si además es rápido (mediana < 3 s). Cada turno anima
     distinto, y nadie repite su intervalo al 8 %.
   - Pruebas: una racha «rápida pero humana» (250–700 ms por elección, 1 s
     por combate, como quien salta las animaciones) pasa. Una lenta (de 20
     s a 4 min por elección, una hora por combate) también.
5. **Se vuelven a jugar los combates**, y todos tienen que ganarse.

**Ordinal 0.** Sin ordinal ni toques solo se admite el **primer** combate de
una racha. Es el combate que una racha vieja tenía a medias cuando llegó esto
(sigue con la semilla de entonces, `semilla|n`). En cualquier otro sitio,
rechaza, para que no sirva para saltarse los toques.

### Dónde corre, y cuánto cuesta

- **Navegador**: un Worker nuevo para cada comprobación, con
  `importScripts(juegos-pokemon.js?v=…)` (la URL la da `carga.js: urlMotor`).
  Al terminar se cierra. `Worker`, `Blob`, `postMessage` y los setters de
  `onmessage`/`onerror` se guardan al cargar el bundle, antes de que la
  consola los pueda tocar.
  - Medido en Chromium: 10 combates en 3,4 s, de los que ~1,7 s son arrancar
    el Worker (el script ya está en caché).
  - El verificador recuerda en la sesión hasta qué combate ya rehízo cada
    racha (`hechas`, comparando el texto exacto del prefijo). El récord
    siguiente solo juega el combate nuevo. Si se toca un combate ya
    comprobado, todo se vuelve a jugar.
  - El plazo es de 30 s más 2 s por combate.
- **Node** (pruebas, auditoría): usa `globalThis.PokeMotor`. Rehacer cuesta
  unos 10 ms por combate (60 combates en 575 ms).
- «No se pudo comprobar…» (sin red, sin motor, plazo agotado) **no acusa**. La
  marca queda pendiente y se reintenta. Un rechazo de verdad no sube, avisa en
  pantalla y llama a `reportaSospecha`. Los logros y la partida del club
  (`alResultado`) salen solo de lo verificado.

## Cambios en el juego

- `frontera.js`:
  - Cada racha guarda `h` (la historia), `t` (los índices del alquiler), `o`
    (el ordinal del combate en curso), `sw` (el cambio pendiente) y `z` (los
    toques del combate en curso, a la par de `elecciones`).
  - `datos` gana `oMax` y `vl` (el libro de victorias, ≤ 3 000).
  - `sube` verifica antes de `guardar(cat, uid, dato, prueba)`. Desaparece la
    «reparación» que subía `datos.mejor`/`datos.victorias` sin prueba.
- `pokemon.js` (una línea): `local.elige(c, ev)` recibe el evento del clic
  para anotar su origen. Las salas de Pokémon no cambian (`pokemon.test.cjs`
  en verde).
- `pokemon/carga.js`: `urlMotor()`.
- `frontera-motor.js`:
  - `validaFrontera` refuta más de cuatro movimientos.
  - Bloque de la prueba: `semillaPelea`, `codificaElecciones`,
    `decodificaElecciones`, `toque`, `leeToques`, `ritmoHumano`,
    `ganaPelea`, `pruebaRacha`, `pruebaVictorias`, `compruebaPrueba`.
- **Rachas de antes**: siguen jugándose, pero sin su historia no pueden subir
  récords nuevos (el menú lo dice). Sus combates sí suman al total. Una racha
  de antes en el combate 1 se adopta sin más. Las marcas pendientes sin
  prueba se descartan.
- **`partida` única por récord**: la racha usa `<semilla>-<n>` (única por
  racha y combate) y el total `fv-<ordinal>` (crece con cada subida).
  Desaparecen las repetibles `fr-…-<uid8>` y `frv-…`.

## `sospecha()` (filas guardadas sin prueba)

Solo marca lo que el juego **nunca** escribió:

- **Forma de `partida`**. En la racha vale `<semilla12hex>-<n>` o
  `fr-<inst>-<nivel>-<n>-<uid8>`, con n = puntos. En el total vale
  `<semilla>-<n>v`, `frv-<total>-<uid8>` (con total = puntos) o `fv-<n>`.
- **Tiempo de la racha < 1 s por combate**. Es el suelo del código desde la
  primera versión.
- **Total < 250 ms por victoria**. Hay un margen ×4 porque `victorias` puede
  subir desde la tabla (otro aparato) sin que suba el `tiempoTot` local.
- No mira el tiempo alto: la fila real `fr-fabrica-50-7-<uid8>` con 604 800 000
  ms (el tope, de la migración de `mejor` sin `tMejor`) es legítima y no se
  marca. Está en las pruebas.

## Límite honesto

- **Un bot que simule los combates fuera** (el motor es público) y fabrique
  la prueba con toques inventados con ruido humano pasa. Lo mismo un
  programa que juegue en la página con clics de verdad (`isTrusted`, p. ej.
  una extensión o un Playwright) a ritmo humano. Solo lo frena el ritmo.
- **El equipo propio no se valida contra un formato**. La Frontera admite
  cualquier equipo guardado, también del formato «Libre» (hackmons), así que
  un set fuera de reglas de Smogon no es trampa. Los EV y IV fuera de rango
  los recorta el propio simulador (0–255 / 0–31). No se comprueba que la
  especie aprenda sus movimientos ni que la habilidad sea suya: hacerlo
  rechazaría equipos honrados del formato libre.
- **Base `b` y `h` del total**: el verificador en vivo se fía de lo que la
  pantalla leyó de la base. Quien escriba en Firebase a mano (vía 5) puede
  poner cualquier base. Se audita con la cadena: cada prueba `fv-<h>` tiene
  que encadenar con la anterior (`b` de esta = `b + l.length` de la que se
  llama `fv-<su h>`).
- **El Palacio no tiene elecciones**: no hay toques que mirar. Un bot que
  solo pulse «¡Combatir!» saca lo mismo que una persona (el Palacio es suerte
  y equipo).
- Un cliente reescrito se salta todo, como en el resto del club.
- Varias pestañas o aparatos a la vez pueden repartir el mismo ordinal. La
  segunda victoria con ese ordinal no cuenta para el total (se descarta en
  silencio, sin acusar) aunque sí para la racha.

## Cambios compartidos pedidos

1. **`colabtex/scripts/auditar-club.cjs`** tiene que cargar el simulador antes
   de verificar filas de la Frontera. En Node el verificador usa
   `globalThis.PokeMotor`, y sin él responde «No se pudo comprobar la
   partida: falta el motor de Pokémon». Bastan dos líneas:

   ```js
   esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/juegos/pokemon/motor-pk.js')], bundle: true, platform: 'node', format: 'cjs', outfile: tmp });
   require(tmp);   // deja globalThis.PokeMotor
   ```

   Opcionalmente, que encadene las pruebas `fv-*` de cada uid (límite
   honesto 3).
2. **`colabtex/package.json`**: añadir `tests/antitrampas-frontera.test.cjs`
   a `test:juegos`.
3. **`CLAUDE.md`**, en la sección de la Frontera: una línea que remita a
   este documento. Los récords se prueban rehaciendo los combates en un
   Worker, cada victoria lleva un ordinal en su semilla, y `local.elige(c, ev)`
   recibe el evento del clic.
4. Nada en las reglas ni en `juegos-main.js`: `guardaClub` ya acepta la
   prueba como cuarto argumento y `reportaSospecha` ya llegaba a
   `crearFrontera`.
